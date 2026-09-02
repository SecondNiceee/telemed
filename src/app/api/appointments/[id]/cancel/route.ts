import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getPayload } from 'payload'
import jwt from 'jsonwebtoken'
import config from '@payload-config'
import { getPayloadJwtSecret } from '@/lib/server/payload-jwt-secret'
import { sendAppointmentCancellationEmail } from '@/utils/sendAppointmentEmail'
import { refundCancelledAppointment } from '@/lib/server/appointment-payments'

const STANDARD_REASONS = [
  'Технические проблемы',
  'Клиент не отвечает/не берет звонок',
  'Другая причина',
] as const

interface DecodedToken { id: number; collection: string }

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const appointmentId = Number((await params).id)
    const token = (await cookies()).get('doctors-token')?.value
    if (!Number.isInteger(appointmentId) || !token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const secret = getPayloadJwtSecret()
    if (!secret) return NextResponse.json({ message: 'Server configuration error' }, { status: 500 })

    let doctor: DecodedToken
    try {
      doctor = jwt.verify(token, secret) as unknown as DecodedToken
    } catch {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 })
    }
    if (doctor.collection !== 'doctors') {
      return NextResponse.json({ message: 'Only doctors can cancel appointments' }, { status: 403 })
    }

    const body = (await request.json()) as { reasonType?: string; customReason?: string }
    if (!body.reasonType || !STANDARD_REASONS.includes(body.reasonType as (typeof STANDARD_REASONS)[number])) {
      return NextResponse.json({ message: 'Укажите причину отмены' }, { status: 400 })
    }
    const reason = body.reasonType === 'Другая причина' ? body.customReason?.trim() : body.reasonType
    if (!reason || reason.length > 500) {
      return NextResponse.json({ message: 'Укажите причину отмены не длиннее 500 символов' }, { status: 400 })
    }

    const payload = await getPayload({ config })
    const appointment = await payload.findByID({
      collection: 'appointments', id: appointmentId, depth: 1, overrideAccess: true,
    })
    const doctorId = typeof appointment.doctor === 'object' ? appointment.doctor.id : appointment.doctor
    if (doctorId !== doctor.id) {
      return NextResponse.json({ message: 'Можно отменить только свою консультацию' }, { status: 403 })
    }
    if (!['confirmed', 'in_progress'].includes(appointment.status)) {
      return NextResponse.json({ message: 'Консультацию в этом статусе нельзя отменить' }, { status: 409 })
    }

    const updated = await payload.update({
      collection: 'appointments', id: appointmentId,
      data: { status: 'cancelled', reason }, overrideAccess: true,
    })

    // Слот пропал не по вине пациента — деньги возвращаем целиком и сразу.
    //
    // Возврат идёт после смены статуса и не влияет на её результат: если ЮKassa
    // недоступна, консультация всё равно остаётся отменённой, а возврат догонит
    // `reconcileAbandonedPayments` — он подбирает отменённые записи с оплаченным
    // платежом. Обратный порядок был бы хуже: упавший возврат заблокировал бы
    // отмену, и врач не смог бы освободить своё время.
    let refunded = false

    try {
      const result = await refundCancelledAppointment({
        payload,
        appointmentId,
        description: 'Возврат за отменённую консультацию',
      })
      refunded = result.refunded
    } catch (error) {
      console.error('[v0][cancel] возврат не удался, догонит сверка', {
        appointmentId,
        error: error instanceof Error ? error.message : error,
      })
    }

    const patient = typeof appointment.user === 'object' ? appointment.user : null
    if (patient?.email) {
      try {
        await sendAppointmentCancellationEmail({
          payload,
          patientEmail: patient.email,
          patientName: appointment.userName || patient.name || 'Пациент',
          doctorName: appointment.doctorName || 'Врач',
          date: appointment.date,
          time: appointment.time,
          reason,
          refunded,
        })
      } catch (error) {
        console.error('Failed to send doctor cancellation email', error)
      }
    }

    return NextResponse.json({ ...updated, refunded })
  } catch (error) {
    console.error('Failed to cancel appointment', error)
    return NextResponse.json({ message: 'Не удалось отменить консультацию' }, { status: 500 })
  }
}
