import { NextRequest, NextResponse } from 'next/server'
import { handlePaymentNotification } from '@/lib/server/appointment-payments'
import { isYooKassaConfigured } from '@/lib/server/yookassa'
import { getYooKassaNotificationIps } from '@/lib/constants/yookassa-ips'
import { isIpInAnyCidr } from '@/lib/server/ip-range'

/**
 * Уведомления ЮKassa (webhook).
 *
 * Адрес для настройки в кабинете ЮKassa:
 *   https://<домен>/api/payments/yookassa/notification
 * События: payment.succeeded, payment.canceled, refund.succeeded.
 *
 * Модель доверия:
 *  1. Уведомление приходит на открытый эндпоинт и НЕ подписано, поэтому телу
 *     запроса мы не верим — из него берём только id платежа.
 *  2. Отправитель фильтруется по IP из официального списка (см.
 *     lib/constants/yookassa-ips.ts).
 *  3. Фактический статус читается напрямую из API ЮKassa (`getPayment`)
 *     в `handlePaymentNotification`.
 *
 * Коды ответа важны: ЮKassa считает доставленным только 200 и повторяет
 * уведомление в течение суток на любой другой код. Поэтому:
 *  - неизвестный платёж → 200 (повторять бессмысленно);
 *  - временная ошибка (БД, сеть до ЮKassa) → 500, чтобы получить повтор.
 */

/** Максимальный размер тела: защита от мусорных запросов на открытый роут. */
const MAX_BODY_BYTES = 64 * 1024

interface NotificationBody {
  type?: string
  event?: string
  object?: {
    id?: string
    status?: string
    payment_id?: string
    metadata?: Record<string, string>
  }
}

/**
 * IP отправителя.
 *
 * За nginx реальный адрес приходит в X-Real-IP / X-Forwarded-For (в конфиге
 * nginx этого проекта они проставляются). Берём ПЕРВЫЙ адрес из
 * X-Forwarded-For — это клиент; последующие добавлены прокси.
 */
function getClientIp(request: NextRequest): string | null {
  const realIp = request.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp

  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }

  return null
}

export async function POST(request: NextRequest) {
  if (!isYooKassaConfigured()) {
    // Без ключей мы всё равно не сможем перечитать платёж.
    return NextResponse.json({ message: 'Платежи не настроены' }, { status: 503 })
  }

  const ip = getClientIp(request)
  const allowedIps = getYooKassaNotificationIps()

  // Локальная отладка: адрес dev-машины в список ЮKassa не входит.
  const trustAllIps = process.env.YOOKASSA_TRUST_ALL_IPS === 'true'

  if (!trustAllIps && (!ip || !isIpInAnyCidr(ip, allowedIps))) {
    console.warn('[v0][yookassa] уведомление с постороннего IP отклонено', { ip })
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  const raw = await request.text()

  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ message: 'Payload too large' }, { status: 413 })
  }

  let body: NotificationBody

  try {
    body = JSON.parse(raw) as NotificationBody
  } catch {
    // Разобрать нечего — повтор не поможет, поэтому 400, а не 500.
    return NextResponse.json({ message: 'Некорректное тело уведомления' }, { status: 400 })
  }

  // Для refund.succeeded id платежа лежит в object.payment_id, для
  // payment.* — в object.id.
  const paymentId = body.object?.payment_id || body.object?.id

  if (!paymentId) {
    return NextResponse.json({ message: 'В уведомлении нет id платежа' }, { status: 400 })
  }

  console.log('[v0][yookassa] уведомление получено', {
    event: body.event ?? body.type,
    paymentId,
    // Статус из тела — только для логов, решения по нему не принимаются.
    reportedStatus: body.object?.status,
  })

  try {
    const { handled } = await handlePaymentNotification({
      paymentId,
      metadataAppointmentId: body.object?.metadata?.appointmentId ?? null,
    })

    // Платёж не наш или запись удалена: повторять доставку незачем.
    if (!handled) return NextResponse.json({ ok: true, handled: false })

    return NextResponse.json({ ok: true, handled: true })
  } catch (err) {
    // Отдаём 500 намеренно: ЮKassa повторит уведомление, и следующая попытка
    // доведёт исход до конца (все переходы идемпотентны).
    console.error('[v0][yookassa] не удалось обработать уведомление', {
      paymentId,
      error: err instanceof Error ? err.message : err,
    })
    return NextResponse.json({ message: 'Обработка не удалась' }, { status: 500 })
  }
}
