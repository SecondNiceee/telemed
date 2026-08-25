import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getUserFromCookies } from '@/lib/server/route-auth'
import { releaseHold } from '@/lib/server/appointment-holds'

/**
 * Отмена неоплаченной брони: пациент нажал «Отменить» или истёк таймер.
 *
 * Слот возвращается в расписание врача, чтобы к этому времени снова можно было
 * записаться, а сама запись удаляется — неоплаченная бронь не должна оседать
 * в личном кабинете как «отменённая консультация». Запись остаётся (в статусе
 * «Отменена») только если с ней связан платёж: см. mustKeepForMoney
 * в lib/server/appointment-holds.ts.
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

    // Оплаченную запись через этот маршрут отменить нельзя.
    if (appointment.status !== 'pending_payment') {
      return NextResponse.json(
        { message: 'Эта запись уже не ожидает оплаты', released: false },
        { status: 409 },
      )
    }

    const released = await releaseHold({ payload, appointmentId })

    return NextResponse.json({ released })
  } catch (err) {
    console.error('Error releasing appointment hold:', err)
    return NextResponse.json({ message: 'Не удалось отменить бронь' }, { status: 500 })
  }
}
