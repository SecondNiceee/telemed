import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getUserFromCookies } from '@/lib/server/route-auth'
import { syncAppointmentPayment } from '@/lib/server/appointment-payments'

/**
 * Статус оплаты записи со сверкой в ЮKassa.
 *
 * Нужен, потому что возврат пользователя на сайт сам по себе ничего не
 * доказывает: `return_url` открывается и при неудачной оплате, и его можно
 * открыть руками. Клиент опрашивает этот роут, а он читает платёж напрямую
 * из ЮKassa и применяет исход — независимо от того, дошло ли уведомление.
 */
export async function GET(
  _request: NextRequest,
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

    const appointment = await payload
      .findByID({ collection: 'appointments', id: appointmentId, overrideAccess: true, depth: 0 })
      .catch(() => null)

    if (!appointment) {
      return NextResponse.json({ message: 'Запись не найдена' }, { status: 404 })
    }

    const appointmentUserId =
      typeof appointment.user === 'object' ? appointment.user.id : appointment.user

    if (appointmentUserId !== user.id) {
      return NextResponse.json({ message: 'Это не ваша запись' }, { status: 403 })
    }

    const synced = await syncAppointmentPayment({ payload, appointmentId })

    // Платежа ещё не было — отдаём текущее состояние записи.
    if (!synced) {
      return NextResponse.json({
        appointmentStatus: appointment.status,
        paymentStatus: null,
        refunded: false,
      })
    }

    return NextResponse.json(synced)
  } catch (err) {
    console.error('Error checking appointment payment status:', err)
    return NextResponse.json({ message: 'Не удалось проверить статус оплаты' }, { status: 500 })
  }
}
