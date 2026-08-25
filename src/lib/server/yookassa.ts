import 'server-only'

import { createHash } from 'crypto'

/**
 * Низкоуровневый клиент ЮKassa (API v3).
 *
 * Здесь только транспорт и типы: авторизация, идемпотентность, разбор ошибок.
 * Бизнес-логика (когда создавать платёж, что делать с succeeded) живёт в
 * `appointment-payments.ts` — этот модуль ничего не знает о записях к врачу.
 *
 * Документация: https://yookassa.ru/developers/api
 */

const API_BASE = 'https://api.yookassa.ru/v3'

/** Таймаут запроса к ЮKassa: платёжный роут не должен висеть на рендере. */
const REQUEST_TIMEOUT_MS = 15_000

/** Статусы платежа в ЮKassa. */
export type YooKassaPaymentStatus = 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled'

export interface YooKassaAmount {
  value: string
  currency: string
}

export interface YooKassaPayment {
  id: string
  status: YooKassaPaymentStatus
  paid: boolean
  amount: YooKassaAmount
  /** Сколько реально зачислено (появляется после succeeded). */
  income_amount?: YooKassaAmount
  refunded_amount?: YooKassaAmount
  description?: string
  confirmation?: {
    type: string
    /** Куда вести пользователя при confirmation.type = redirect. */
    confirmation_url?: string
    return_url?: string
  }
  created_at: string
  expires_at?: string
  captured_at?: string
  metadata?: Record<string, string>
  cancellation_details?: { party?: string; reason?: string }
  payment_method?: { type?: string; title?: string; saved?: boolean }
}

export interface YooKassaRefund {
  id: string
  status: 'pending' | 'succeeded' | 'canceled'
  payment_id: string
  amount: YooKassaAmount
  created_at: string
}

/** Ошибка ЮKassa: код и id запроса нужны для разбора инцидентов в поддержке. */
export class YooKassaError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly body?: unknown,
  ) {
    super(message)
    this.name = 'YooKassaError'
  }
}

export interface YooKassaConfig {
  shopId: string
  secretKey: string
  /** vat_code для позиции чека (1 — без НДС, 2 — 0%, 4 — 20% и т.д.). */
  vatCode: number
  paymentSubject: string
  paymentMode: string
  /** Отправлять ли данные чека (54-ФЗ) вместе с платежом. */
  sendReceipt: boolean
}

/**
 * Конфигурация из окружения.
 * Возвращает null, если ключи не заданы, — вызывающий сам решает, отдать ли
 * пользователю понятную 503 вместо падения роута.
 */
export function getYooKassaConfig(): YooKassaConfig | null {
  const shopId = process.env.YOOKASSA_SHOP_ID?.trim()
  const secretKey = process.env.YOOKASSA_SECRET_KEY?.trim()

  if (!shopId || !secretKey) return null

  const vatCode = Number(process.env.YOOKASSA_VAT_CODE ?? 1)

  return {
    shopId,
    secretKey,
    vatCode: Number.isInteger(vatCode) && vatCode >= 1 && vatCode <= 6 ? vatCode : 1,
    paymentSubject: process.env.YOOKASSA_PAYMENT_SUBJECT?.trim() || 'service',
    paymentMode: process.env.YOOKASSA_PAYMENT_MODE?.trim() || 'full_prepayment',
    // Чек включён по умолчанию: у магазина с онлайн-фискализацией платёж без
    // receipt отклоняется. Отключается явным YOOKASSA_SEND_RECEIPT=false.
    sendReceipt: process.env.YOOKASSA_SEND_RECEIPT !== 'false',
  }
}

/** Настроена ли интеграция (для guard'ов в роутах). */
export function isYooKassaConfigured(): boolean {
  return getYooKassaConfig() !== null
}

function requireConfig(): YooKassaConfig {
  const config = getYooKassaConfig()
  if (!config) {
    throw new YooKassaError(
      503,
      'Оплата временно недоступна: не настроены ключи платёжного провайдера.',
      'not_configured',
    )
  }
  return config
}

/** Сумма в формате ЮKassa: строка с двумя знаками после запятой. */
export function toYooKassaAmount(rubles: number): string {
  if (!Number.isFinite(rubles) || rubles < 0) {
    throw new YooKassaError(400, 'Некорректная сумма платежа', 'invalid_amount')
  }
  // Округляем до копеек через целые, чтобы не поймать 0.1 + 0.2.
  return (Math.round(rubles * 100) / 100).toFixed(2)
}

/**
 * Детерминированный Idempotence-Key.
 *
 * ЮKassa по одному ключу возвращает тот же платёж вместо создания нового,
 * поэтому двойной клик по «Оплатить» не плодит платежи. Ключ обязан зависеть
 * от попытки: для новой брони (нового paymentExpiresAt) он должен отличаться.
 */
export function buildIdempotenceKey(...parts: (string | number)[]): string {
  return createHash('sha256').update(parts.join(':')).digest('hex').slice(0, 36)
}

async function request<T>(
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown; idempotenceKey?: string },
): Promise<T> {
  const config = requireConfig()
  const auth = Buffer.from(`${config.shopId}:${config.secretKey}`).toString('base64')

  const headers: Record<string, string> = {
    Authorization: `Basic ${auth}`,
    'Content-Type': 'application/json',
  }

  // Для POST ключ идемпотентности обязателен: без него повторная отправка
  // (ретрай fetch'а, двойной клик) создаёт второй платёж.
  if (init.method === 'POST') {
    headers['Idempotence-Key'] = init.idempotenceKey ?? crypto.randomUUID()
  }

  let response: Response

  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: init.method,
      headers,
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: 'no-store',
    })
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    throw new YooKassaError(0, `Платёжный сервис недоступен: ${reason}`, 'network_error')
  }

  const text = await response.text()
  let body: unknown = null

  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      // Не-JSON от ЮKassa бывает только при проблемах на их стороне.
    }
  }

  if (!response.ok) {
    const error = body as { description?: string; code?: string; id?: string } | null
    console.error('[yookassa] request failed', {
      path,
      method: init.method,
      status: response.status,
      code: error?.code,
      requestId: error?.id,
      description: error?.description,
    })

    throw new YooKassaError(
      response.status,
      error?.description || `Ошибка платёжного сервиса (${response.status})`,
      error?.code,
      body,
    )
  }

  return body as T
}

export interface CreatePaymentInput {
  /** Сумма в рублях. */
  amount: number
  description: string
  returnUrl: string
  /** Попадает в уведомление и в личный кабинет ЮKassa. */
  metadata: Record<string, string>
  idempotenceKey: string
  /** Данные для чека (54-ФЗ). */
  receipt?: {
    email?: string | null
    phone?: string | null
    itemDescription: string
  }
}

/**
 * Создать платёж со сценарием redirect.
 *
 * `capture: true` — одностадийный платёж: деньги списываются сразу, без
 * отдельного шага подтверждения. Двухстадийность здесь не нужна: подтверждать
 * бронь всё равно решает не оператор, а факт оплаты.
 */
export async function createPayment(input: CreatePaymentInput): Promise<YooKassaPayment> {
  const config = requireConfig()
  const value = toYooKassaAmount(input.amount)

  const body: Record<string, unknown> = {
    amount: { value, currency: 'RUB' },
    capture: true,
    confirmation: { type: 'redirect', return_url: input.returnUrl },
    description: input.description.slice(0, 128),
    metadata: input.metadata,
  }

  // Чек нужен магазинам с онлайн-фискализацией. Без контакта покупателя
  // ЮKassa чек не примет, поэтому receipt добавляем только с email/телефоном.
  if (config.sendReceipt && input.receipt && (input.receipt.email || input.receipt.phone)) {
    body.receipt = {
      customer: {
        ...(input.receipt.email ? { email: input.receipt.email } : {}),
        ...(input.receipt.phone ? { phone: input.receipt.phone } : {}),
      },
      items: [
        {
          description: input.receipt.itemDescription.slice(0, 128),
          quantity: '1.00',
          amount: { value, currency: 'RUB' },
          vat_code: config.vatCode,
          payment_subject: config.paymentSubject,
          payment_mode: config.paymentMode,
        },
      ],
    }
  }

  return request<YooKassaPayment>('/payments', {
    method: 'POST',
    body,
    idempotenceKey: input.idempotenceKey,
  })
}

/**
 * Прочитать платёж из ЮKassa.
 * Это единственный источник правды о статусе оплаты: тело уведомления
 * приходит по открытому HTTP-эндпоинту и подписи не имеет.
 */
export async function getPayment(paymentId: string): Promise<YooKassaPayment> {
  return request<YooKassaPayment>(`/payments/${encodeURIComponent(paymentId)}`, { method: 'GET' })
}

/**
 * Отменить платёж, по которому деньги ещё не списаны.
 *
 * ВАЖНО: ЮKassa принимает отмену ТОЛЬКО в статусе `waiting_for_capture`
 * (предавторизация — деньги захолдированы на карте, но не списаны). Платёж в
 * статусе `pending` отменить нельзя: он ещё не авторизован и ждёт действий
 * пользователя, ЮKassa отменит его сама по истечении срока жизни. Поэтому
 * вызывать эту функцию имеет смысл только для `waiting_for_capture`.
 *
 * Мы создаём платежи с `capture: true`, так что в `waiting_for_capture` они
 * штатно не задерживаются, — но если платёж там всё же оказался, отмена снимает
 * холд с карты пациента, а не держит его деньги до автоотмены.
 */
export async function cancelPayment({
  paymentId,
  idempotenceKey,
}: {
  paymentId: string
  idempotenceKey: string
}): Promise<YooKassaPayment> {
  return request<YooKassaPayment>(`/payments/${encodeURIComponent(paymentId)}/cancel`, {
    method: 'POST',
    body: {},
    idempotenceKey,
  })
}

/** Полный возврат средств по платежу. */
export async function createRefund({
  paymentId,
  amount,
  idempotenceKey,
  description,
}: {
  paymentId: string
  amount: number
  idempotenceKey: string
  description?: string
}): Promise<YooKassaRefund> {
  return request<YooKassaRefund>('/refunds', {
    method: 'POST',
    body: {
      payment_id: paymentId,
      amount: { value: toYooKassaAmount(amount), currency: 'RUB' },
      ...(description ? { description: description.slice(0, 250) } : {}),
    },
    idempotenceKey,
  })
}

/** Сумма платежа в рублях (из строкового формата ЮKassa). */
export function parseYooKassaAmount(amount?: YooKassaAmount | null): number {
  const parsed = Number(amount?.value)
  return Number.isFinite(parsed) ? parsed : 0
}
