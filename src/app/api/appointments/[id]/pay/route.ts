import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getUserFromCookies } from '@/lib/server/route-auth'
import { releaseHold } from '@/lib/server/appointment-holds'

/**
 * Оплата консультации.
 *
 * Пока это заглушка платёжного провайдера: успешный вызов просто переводит
 * запись из «Ожидает оплаты» в «Подтверждена». Слот к этому моменту уже
 * забронирован (удалён из расписания при создании записи).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const appointmentId = parseInt(id, 10)

    if (isNaN(appointmentId)) {
      return NextResponse.json({ message: 'Некорректный ID записи' }, { status: 400 })
    }

    const { user, error } = await getUserFromCookies()
    if (error) {
      return NextResponse.json({ message: error.message }, { status: error.status })
    }

    const payload = await getPayload({ config })

    const appointment = await payload.findByID({
      collection: 'appointments',
      id: appointmentId,
      overrideAccess: true,
      depth: 0,
    })

    if (!appointment) {
      return NextResponse.json({ message: 'Запись не найдена' }, { status: 404 })
    }

    const appointmentUserId =
      typeof appointment.user === 'object' ? appointment.user.id : appointment.user

    if (appointmentUserId !== user.id) {
      return NextResponse.json({ message: 'Это не ваша запись' }, { status: 403 })
    }

    if (appointment.status === 'confirmed') {
      // Идемпотентность: повторный клик по «Оплатить» не считается ошибкой.
      return NextResponse.json(appointment)
    }

    if (appointment.status !== 'pending_payment') {
      return NextResponse.json(
        { message: 'Эту запись нельзя оплатить' },
        { status: 409 },
      )
    }

    // Бронь истекла — освобождаем слот и просим записаться заново.
    const expiresAt = appointment.paymentExpiresAt
    if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
      await releaseHold({ payload, appointmentId })
      return NextResponse.json(
        { message: 'Время на оплату истекло, слот снова свободен', expired: true },
        { status: 410 },
      )
    }

    const updated = await payload.update({
      collection: 'appointments',
      id: appointmentId,
      data: {
        status: 'confirmed',
        paidAt: new Date().toISOString(),
      },
      overrideAccess: true,
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('Error paying for appointment:', err)
    return NextResponse.json({ message: 'Не удалось выполнить оплату' }, { status: 500 })
  }
}
