import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getUserFromCookies } from '@/lib/server/route-auth'
import { PaymentFlowError, startAppointmentPayment } from '@/lib/server/appointment-payments'

/**
 * Начать оплату консультации в ЮKassa.
 *
 * Роут НЕ подтверждает запись — он только создаёт платёж и отдаёт ссылку, по
 * которой пациента нужно увести на страницу оплаты. Подтверждение делает
 * только фактическое поступление денег: обработчик уведомлений
 * (`/api/payments/yookassa/notification`) или сверка при возврате пациента
 * (`/api/appointments/[id]/payment-status`).
 *
 * Ответы:
 *  - 200 `{ confirmationUrl }` — уводим пользователя на ЮKassa;
 *  - 200 `{ status: 'confirmed' }` — платёж уже прошёл (двойной клик);
 *  - 410 `{ expired: true }` — бронь истекла, слот освобождён.
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

    // Куда ЮKassa вернёт пациента после оплаты. Возврат — это НЕ подтверждение:
    // страница по этому адресу сама сверяет платёж с ЮKassa.
    const origin = process.env.SERVER_URL?.trim() || new URL(request.url).origin
    const returnUrl = `${origin.replace(/\/$/, '')}/appointment/${appointmentId}/payment?return=1`

    const result = await startAppointmentPayment({ payload, appointmentId, returnUrl })

    if (result.kind === 'already_paid') {
      return NextResponse.json({ status: 'confirmed' })
    }

    if (result.kind === 'expired') {
      return NextResponse.json(
        { message: 'Время на оплату истекло, слот снова свободен', expired: true },
        { status: 410 },
      )
    }

    return NextResponse.json({
      status: 'pending',
      confirmationUrl: result.confirmationUrl,
      paymentId: result.paymentId,
    })
  } catch (err) {
    if (err instanceof PaymentFlowError) {
      return NextResponse.json({ message: err.message, code: err.code }, { status: err.status })
    }

    console.error('Error starting appointment payment:', err)
    return NextResponse.json({ message: 'Не удалось начать оплату' }, { status: 500 })
  }
}
