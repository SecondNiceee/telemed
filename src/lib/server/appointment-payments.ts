import 'server-only'

import { getPayload } from 'payload'
import config from '@payload-config'
import {
  buildIdempotenceKey,
  cancelPayment,
  createPayment,
  createRefund,
  getPayment,
  isYooKassaConfigured,
  parseYooKassaAmount,
  YooKassaError,
  type YooKassaPayment,
} from './yookassa'
import {
  deleteReleasedHold,
  releaseHold,
  type AppointmentMoneyState,
} from './appointment-holds'
import { formatDate } from '@/lib/utils/date'

/**
 * Бизнес-логика оплаты консультации.
 *
 * Разделение с `yookassa.ts`: там только транспорт (HTTP, авторизация,
 * идемпотентность), здесь — все решения о записи: когда создавать платёж, что
 * делать с `succeeded`, когда возвращать деньги.
 *
 * Главный принцип: статус из тела уведомления НЕ является источником правды.
 * Уведомление приходит на открытый эндпоинт без подписи, поэтому любое решение
 * принимается только после `getPayment()` — прямого чтения платежа из ЮKassa.
 *
 * Второй принцип: все переходы идемпотентны. Один и тот же платёж приезжает
 * минимум дважды (уведомление + сверка при возврате пользователя на сайт), а
 * ЮKassa повторяет уведомление, пока не получит 200.
 */

type PayloadInstance = Awaited<ReturnType<typeof getPayload>>

export const PAYMENT_PROVIDER = 'yookassa'

/** Статус платежа в нашей БД: статусы ЮKassa + локальный `refunded`. */
export type AppointmentPaymentStatus =
  | 'pending'
  | 'waiting_for_capture'
  | 'succeeded'
  | 'canceled'
  | 'refunded'

/** Группа `payment` из коллекции Appointments. */
export interface AppointmentPaymentState {
  provider?: string | null
  paymentId?: string | null
  status?: AppointmentPaymentStatus | null
  amount?: number | null
  method?: string | null
  attempts?: number | null
  refundId?: string | null
  refundedAt?: string | null
  checkedAt?: string | null
}

/** Минимум полей записи, нужный этому модулю. */
interface AppointmentLike {
  id: number
  status: string
  date: string
  time: string
  price?: number | null
  doctorName?: string | null
  specialty?: string | null
  user: unknown
  doctor: unknown
  paymentExpiresAt?: string | null
  paidAt?: string | null
  payment?: AppointmentPaymentState | null
}

/** Ошибка с готовым HTTP-статусом и текстом для пользователя. */
export class PaymentFlowError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'PaymentFlowError'
  }
}

/** Извлечь числовой id из relationship-поля Payload. */
function toId(raw: unknown): number {
  return typeof raw === 'object' && raw !== null ? Number((raw as { id: unknown }).id) : Number(raw)
}

/** Бронь ещё жива? */
function isHoldActive(appointment: AppointmentLike): boolean {
  if (!appointment.paymentExpiresAt) return true
  return new Date(appointment.paymentExpiresAt).getTime() > Date.now()
}

/**
 * Полный объект группы `payment` для записи в БД.
 *
 * Payload при обновлении группы может перезаписать её целиком, поэтому мы
 * никогда не отправляем частичный патч: отсутствующий `paymentId` иначе
 * обнулился бы, и уведомление перестало бы находить свою запись.
 */
function buildPaymentData(
  current: AppointmentPaymentState | null | undefined,
  patch: Partial<AppointmentPaymentState>,
): AppointmentPaymentState {
  return {
    provider: patch.provider ?? current?.provider ?? PAYMENT_PROVIDER,
    paymentId: patch.paymentId ?? current?.paymentId ?? null,
    status: patch.status ?? current?.status ?? null,
    amount: patch.amount ?? current?.amount ?? null,
    method: patch.method ?? current?.method ?? null,
    attempts: patch.attempts ?? current?.attempts ?? 0,
    refundId: patch.refundId ?? current?.refundId ?? null,
    refundedAt: patch.refundedAt ?? current?.refundedAt ?? null,
    checkedAt: patch.checkedAt ?? current?.checkedAt ?? null,
  }
}

/** Записать группу `payment`, не трогая остальные поля записи. */
async function savePayment({
  payload,
  appointment,
  patch,
}: {
  payload: PayloadInstance
  appointment: AppointmentLike
  patch: Partial<AppointmentPaymentState>
}): Promise<AppointmentPaymentState> {
  const payment = buildPaymentData(appointment.payment, patch)

  await payload.update({
    collection: 'appointments',
    id: appointment.id,
    data: { payment } as Record<string, unknown>,
    overrideAccess: true,
    depth: 0,
  })

  appointment.payment = payment
  return payment
}

/** Локальный статус платежа по данным ЮKassa (без учёта возвратов). */
function toLocalStatus(payment: YooKassaPayment): AppointmentPaymentStatus {
  return payment.status
}

/** Рубли в копейки: сравнивать суммы можно только целыми. */
function toKopecks(rubles: number): number {
  return Math.round(rubles * 100)
}

/**
 * Совпадает ли платёж со стоимостью консультации.
 *
 * Платежи создаём только мы, поэтому расхождение — это либо баг (цена врача
 * изменилась между созданием платежа и оплатой), либо чужой платёж, который
 * притянуло к записи. В обоих случаях подтверждать запись нельзя: возвращаем
 * текст расхождения для лога и уходим в возврат.
 */
function findAmountMismatch(
  appointment: AppointmentLike,
  payment: YooKassaPayment,
): string | null {
  const currency = payment.amount?.currency

  if (currency !== 'RUB') {
    return `валюта платежа ${currency ?? 'не указана'}, ожидали RUB`
  }

  const expected = toKopecks(Number(appointment.price ?? 0))
  const actual = toKopecks(parseYooKassaAmount(payment.amount))

  if (!Number.isFinite(expected) || expected <= 0) {
    return 'у консультации не указана стоимость'
  }

  if (expected !== actual) {
    return `ожидали ${expected / 100} ₽, оплачено ${actual / 100} ₽`
  }

  return null
}

/** Деньги по платежу уже полностью возвращены? */
function isFullyRefunded(payment: YooKassaPayment): boolean {
  const refunded = toKopecks(parseYooKassaAmount(payment.refunded_amount))
  if (refunded <= 0) return false
  return refunded >= toKopecks(parseYooKassaAmount(payment.amount))
}

/** Описание платежа: видно и пациенту в ЮKassa, и нам в их кабинете. */
function buildDescription(appointment: AppointmentLike): string {
  const doctor = appointment.doctorName || 'врач'
  return `Консультация ${doctor}, ${formatDate(appointment.date)} ${appointment.time}`
}

/**
 * Прочитать запись со всем, что нужно платёжному слою.
 * `depth: 0` — связи нужны только как id.
 */
async function loadAppointment(
  payload: PayloadInstance,
  appointmentId: number,
): Promise<AppointmentLike | null> {
  const appointment = await payload
    .findByID({ collection: 'appointments', id: appointmentId, depth: 0, overrideAccess: true })
    .catch(() => null)

  return (appointment as AppointmentLike | null) ?? null
}

export type StartPaymentResult =
  /** Нужно увести пользователя на страницу оплаты ЮKassa. */
  | { kind: 'redirect'; confirmationUrl: string; paymentId: string }
  /** Платёж уже прошёл (двойной клик, вернувшееся уведомление). */
  | { kind: 'already_paid' }
  /** Бронь истекла: слот освобождён, записываться нужно заново. */
  | { kind: 'expired' }

/**
 * Начать (или продолжить) оплату консультации.
 *
 * Права и владельца записи проверяет вызывающий роут — здесь только платёжная
 * логика.
 *
 * Повторный вызов не создаёт второй платёж:
 *  - если у записи уже есть незавершённый ��латёж, он перечитывается из ЮKassa
 *    и пользователь уходит по тому же `confirmation_url`;
 *  - если платёж успел завершиться — применяем его результат;
 *  - новый платёж создаётся только после отменённого, и его `Idempotence-Key`
 *    включает номер попытки, поэтому двойной клик по-прежнему безопасен.
 */
export async function startAppointmentPayment({
  payload,
  appointmentId,
  returnUrl,
}: {
  payload: PayloadInstance
  appointmentId: number
  returnUrl: string
}): Promise<StartPaymentResult> {
  if (!isYooKassaConfigured()) {
    throw new PaymentFlowError(
      503,
      'Оплата временно недоступна. Попробуйте позже или свяжитесь с клиникой.',
      'not_configured',
    )
  }

  const appointment = await loadAppointment(payload, appointmentId)
  if (!appointment) throw new PaymentFlowError(404, 'Запись не найдена')

  // Уже подтверждённая запись: платить второй раз нечего.
  if (appointment.status !== 'pending_payment') {
    if (appointment.status === 'confirmed') return { kind: 'already_paid' }
    throw new PaymentFlowError(409, 'Эту запись нельзя оплатить')
  }

  // Незавершённый платёж мог завершиться, пока пользователь был на стороне
  // ЮKassa: сверяемся до всех решений, включая проверку срока брони.
  const existingPaymentId = appointment.payment?.paymentId
  if (existingPaymentId) {
    const synced = await syncAppointmentPayment({ payload, appointmentId })

    if (synced?.appointmentStatus === 'confirmed') return { kind: 'already_paid' }

    // Возврат уже сделан (деньги пришли после истечения брони) или бронь снята.
    if (synced && synced.appointmentStatus !== 'pending_payment') {
      return { kind: 'expired' }
    }
  }

  const fresh = (await loadAppointment(payload, appointmentId)) ?? appointment

  if (fresh.status === 'confirmed') return { kind: 'already_paid' }
  if (fresh.status !== 'pending_payment') return { kind: 'expired' }

  // Бронь истекла — слот возвращаем врачу и просим записаться заново.
  if (!isHoldActive(fresh)) {
    await releaseHold({ payload, appointmentId })
    return { kind: 'expired' }
  }

  const amount = Number(fresh.price ?? 0)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new PaymentFlowError(409, 'У этой консультации не указана стоимость', 'invalid_amount')
  }

  // --- Продолжаем существующий платёж, если он всё ещё ждёт оплаты.
  const currentStatus = fresh.payment?.status
  if (fresh.payment?.paymentId && (currentStatus === 'pending' || currentStatus === 'waiting_for_capture')) {
    try {
      const existing = await getPayment(fresh.payment.paymentId)
      const url = existing.confirmation?.confirmation_url

      if (existing.status === 'pending' && url) {
        return { kind: 'redirect', confirmationUrl: url, paymentId: existing.id }
      }
    } catch (err) {
      // Платёж не читается — не блокируем пациента, создадим новый ниже.
      console.error('[v0][payments] не удалось перечитать платёж', {
        appointmentId,
        paymentId: fresh.payment.paymentId,
        error: err instanceof Error ? err.message : err,
      })
    }
  }

  // --- Новый платёж.
  const attempt = Number(fresh.payment?.attempts ?? 0) + 1
  const userId = toId(fresh.user)

  const patient = await payload
    .findByID({ collection: 'users', id: userId, depth: 0, overrideAccess: true })
    .catch(() => null)

  // Ключ идемпотентности зависит от попытки и от срока брони: двойной клик
  // получает тот же платёж, а новая попытка после отмены — новый.
  const idempotenceKey = buildIdempotenceKey(
    'appointment-payment',
    fresh.id,
    attempt,
    fresh.paymentExpiresAt ?? '',
  )

  let payment: YooKassaPayment

  try {
    payment = await createPayment({
      amount,
      description: buildDescription(fresh),
      returnUrl,
      metadata: {
        appointmentId: String(fresh.id),
        userId: String(userId),
      },
      idempotenceKey,
      receipt: {
        email: patient?.email ?? null,
        phone: (patient as { phone?: string | null } | null)?.phone ?? null,
        itemDescription: buildDescription(fresh),
      },
    })
  } catch (err) {
    if (err instanceof YooKassaError) {
      // 4xx от ЮKassa — это наша ошибка данных, наружу отдаём нейтральный текст.
      const status = err.status >= 500 || err.status === 0 ? 503 : 502
      throw new PaymentFlowError(
        status,
        'Не удалось создать платёж. Попробуйте ещё раз через минуту.',
        err.code,
      )
    }
    throw err
  }

  await savePayment({
    payload,
    appointment: fresh,
    patch: {
      provider: PAYMENT_PROVIDER,
      paymentId: payment.id,
      status: toLocalStatus(payment),
      amount: parseYooKassaAmount(payment.amount),
      method: payment.payment_method?.type ?? null,
      attempts: attempt,
      checkedAt: new Date().toISOString(),
      // Новая попытка — прошлый возврат к ней не относится.
      refundId: null,
      refundedAt: null,
    },
  })

  const confirmationUrl = payment.confirmation?.confirmation_url

  if (!confirmationUrl) {
    // Платёж создан, но вести пользователя некуда: сценарий redirect обязан
    // вернуть ссылку. Уведомление всё равно разберёт исход.
    throw new PaymentFlowError(
      502,
      'Платёжный сервис не вернул ссылку на оплату. Попробуйте ещё раз.',
      'no_confirmation_url',
    )
  }

  return { kind: 'redirect', confirmationUrl, paymentId: payment.id }
}

export interface SyncResult {
  appointmentStatus: string
  paymentStatus: AppointmentPaymentStatus | null
  /** Деньги вернули: оплата пришла, когда слот уже был отдан. */
  refunded: boolean
}

/**
 * Сверить платёж записи с ЮKassa и применить исход.
 *
 * Вызывается из двух мест: обработчика уведомлений и страницы/поллинга при
 * возврате пользователя на сайт. Возвращает null, если у записи нет платежа.
 */
export async function syncAppointmentPayment({
  payload,
  appointmentId,
}: {
  payload: PayloadInstance
  appointmentId: number
}): Promise<SyncResult | null> {
  const appointment = await loadAppointment(payload, appointmentId)
  if (!appointment) return null

  const paymentId = appointment.payment?.paymentId
  if (!paymentId) return null

  // Всё уже разобрано: деньги вернули или запись подтверждена — в ЮKassa
  // ходить незачем.
  if (appointment.payment?.status === 'refunded') {
    return { appointmentStatus: appointment.status, paymentStatus: 'refunded', refunded: true }
  }

  // Запись подтверждена и оплачена — исход доведён до конца.
  // `cancelled` сюда не попадает: по отменённой записи деньги ещё должны
  // вернуться, и сверка — единственный способ догнать упавший возврат.
  if (
    appointment.payment?.status === 'succeeded' &&
    appointment.status !== 'pending_payment' &&
    appointment.status !== 'cancelled'
  ) {
    return {
      appointmentStatus: appointment.status,
      paymentStatus: 'succeeded',
      refunded: false,
    }
  }

  let payment: YooKassaPayment

  try {
    payment = await getPayment(paymentId)
  } catch (err) {
    // Сверку не удалось выполнить — состояние в БД не меняем. Уведомление
    // ЮKassa повторится, а поллинг на странице попробует снова.
    console.error('[v0][payments] сверка с ЮKassa не удалась', {
      appointmentId,
      paymentId,
      error: err instanceof Error ? err.message : err,
    })
    return {
      appointmentStatus: appointment.status,
      paymentStatus: appointment.payment?.status ?? null,
      refunded: false,
    }
  }

  return applyPaymentOutcome({ payload, appointment, payment })
}

/**
 * Применить фактическое состояние платежа к записи.
 *
 * `payment` обязан быть прочитан из ЮKassa (`getPayment`), а не взят из тела
 * уведомления.
 */
export async function applyPaymentOutcome({
  payload,
  appointment,
  payment,
}: {
  payload: PayloadInstance
  appointment: AppointmentLike
  payment: YooKassaPayment
}): Promise<SyncResult> {
  const now = new Date().toISOString()
  const common = {
    status: toLocalStatus(payment),
    amount: parseYooKassaAmount(payment.amount),
    method: payment.payment_method?.type ?? null,
    checkedAt: now,
  }

  // --- Платёж не завершён: только обновляем снимок состояния.
  if (payment.status !== 'succeeded') {
    await savePayment({ payload, appointment, patch: common })

    return {
      appointmentStatus: appointment.status,
      paymentStatus: common.status,
      refunded: false,
    }
  }

  // --- Деньги получены.

  // Запись уже подтверждена (или идёт/завершена) — просто фиксируем платёж.
  if (appointment.status !== 'pending_payment' && appointment.status !== 'cancelled') {
    await savePayment({ payload, appointment, patch: common })
    return { appointmentStatus: appointment.status, paymentStatus: 'succeeded', refunded: false }
  }

  // Слот уже потерян: бронь истекла или была отменена, пока шла оплата.
  // Деньги возвращаем автоматически.
  if (appointment.status === 'cancelled' || !isHoldActive(appointment)) {
    return refundLatePayment({
      payload,
      appointment,
      payment,
      snapshot: common,
      // Запись с `paidAt` была подтверждена и оплачена, а потом отменена —
      // это возврат за отменённую консультацию, а не опоздавшая оплата.
      description: appointment.paidAt
        ? 'Возврат за отменённую консультацию'
        : 'Время консультации было занято до поступления оплаты',
    })
  }

  // Пришла не та сумма (или не та валюта) — подтверждать запись нельзя:
  // деньги возвращаем, слот отдаём обратно в расписание.
  const mismatch = findAmountMismatch(appointment, payment)

  if (mismatch) {
    console.error('[v0][payments] сумма платежа не совпала со стоимостью консультации', {
      appointmentId: appointment.id,
      paymentId: payment.id,
      mismatch,
    })

    return refundLatePayment({
      payload,
      appointment,
      payment,
      snapshot: common,
      description: 'Сумма платежа не соответствует стоимости консультации',
    })
  }

  // --- Бронь ещё жива: подтверждаем запись.
  const paidAt = payment.captured_at ?? now

  // Условие по статусу прямо в UPDATE: между чтением и записью запись мог
  // отменить sweeper или сам пациент — тогда апдейт не заденет ни одной строки,
  // и мы уйдём в ветку возврата вместо «подтверждения отменённой записи».
  const result = await payload.update({
    collection: 'appointments',
    where: {
      id: { equals: appointment.id },
      status: { equals: 'pending_payment' },
    },
    data: {
      status: 'confirmed',
      paidAt,
      payment: buildPaymentData(appointment.payment, common),
    } as Record<string, unknown>,
    overrideAccess: true,
    depth: 0,
  })

  for (const error of result.errors ?? []) {
    console.error('[v0][payments] не удалось подтвердить запись', error)
  }

  if ((result.docs ?? []).length === 0) {
    // Бронь ушла из pending_payment между чтением и записью — перечитываем и
    // возвращаем деньги, если слот действительно потерян.
    const fresh = await loadAppointment(payload, appointment.id)

    if (!fresh) {
      return { appointmentStatus: appointment.status, paymentStatus: 'succeeded', refunded: false }
    }

    if (fresh.status === 'confirmed') {
      await savePayment({ payload, appointment: fresh, patch: common })
      return { appointmentStatus: 'confirmed', paymentStatus: 'succeeded', refunded: false }
    }

    return refundLatePayment({
      payload,
      appointment: fresh,
      payment,
      snapshot: common,
      description: 'Время консультации было занято до поступления оплаты',
    })
  }

  console.log('[v0][payments] запись подтверждена оплатой', {
    appointmentId: appointment.id,
    paymentId: payment.id,
  })

  return { appointmentStatus: 'confirmed', paymentStatus: 'succeeded', refunded: false }
}

/**
 * Оплата пришла, когда слот уже потерян: возвращаем деньги и снимаем бронь.
 *
 * Порядок шагов важен:
 *  1. `succeeded` в БД — чтобы sweeper не отменил бронь, пока идёт возврат;
 *  2. сам возврат в ЮKassa (ключ идемпотентности привязан к платежу, поэтому
 *     повторный вызов не вернёт деньги дважды);
 *  3. `refunded` в БД;
 *  4. снятие брони и возврат слота врачу.
 *
 * Если шаг 2 или 4 упадёт, состояние остаётся согласованным: запись видна как
 * `succeeded`/`refunded`, а повторная сверка (уведомление ЮKassa повторяется)
 * доведёт процесс до конца.
 */
async function refundLatePayment({
  payload,
  appointment,
  payment,
  snapshot,
  description,
}: {
  payload: PayloadInstance
  appointment: AppointmentLike
  payment: YooKassaPayment
  snapshot: Partial<AppointmentPaymentState>
  /** Причина возврата: видна пациенту в выписке и нам в кабинете ЮKassa. */
  description: string
}): Promise<SyncResult> {
  // Уже возвращали — второй раз не нужно. Проверяем и наш след (refundId), и
  // факт из ЮKassa: возврат мог пройти, а запись о нём — не сохраниться.
  if (appointment.payment?.refundId || isFullyRefunded(payment)) {
    await savePayment({
      payload,
      appointment,
      patch: { ...snapshot, status: 'refunded', checkedAt: new Date().toISOString() },
    })

    // Возврат прошёл, а бронь могла остаться висеть (падение после refund) —
    // добиваем: слот возвращаем врачу.
    if (appointment.status === 'pending_payment') {
      await releaseHold({ payload, appointmentId: appointment.id })
      return { appointmentStatus: 'cancelled', paymentStatus: 'refunded', refunded: true }
    }

    return { appointmentStatus: appointment.status, paymentStatus: 'refunded', refunded: true }
  }

  await savePayment({ payload, appointment, patch: snapshot })

  const amount = parseYooKassaAmount(payment.amount)

  console.warn('[v0][payments] возвращаем деньги по оплаченной записи', {
    appointmentId: appointment.id,
    paymentId: payment.id,
    amount,
    reason: description,
  })

  const refund = await createRefund({
    paymentId: payment.id,
    amount,
    idempotenceKey: buildIdempotenceKey('appointment-refund', payment.id),
    description,
  })

  await savePayment({
    payload,
    appointment,
    patch: {
      status: 'refunded',
      refundId: refund.id,
      refundedAt: new Date().toISOString(),
      checkedAt: new Date().toISOString(),
    },
  })

  // Бронь всё ещё висит — снимаем её и возвращаем слот в расписание.
  if (appointment.status === 'pending_payment') {
    await releaseHold({ payload, appointmentId: appointment.id })
  }

  return { appointmentStatus: 'cancelled', paymentStatus: 'refunded', refunded: true }
}

/**
 * Вернуть деньги за отменённую консультацию.
 *
 * Вызывается, когда врач отменяет уже оплаченную запись: слот пропал не по вине
 * пациента, поэтому деньги возвращаются целиком и без его участия.
 *
 * Функция не меняет статус самой записи — её отменяет вызывающий роут. Здесь
 * только деньги, поэтому упавший возврат не мешает отмене состояться.
 *
 * Идемпотентность: исход целиком отдан `refundLatePayment`, который сверяется и
 * с нашим `refundId`, и с `refunded_amount` из ЮKassa. Повторный вызов (двойной
 * клик, ретрай сверки) деньги дважды не вернёт.
 *
 * Возвращает `refunded: false`, если возвращать нечего: платежа нет, он не
 * дошёл до `succeeded` или ЮKassa не настроена.
 */
export async function refundCancelledAppointment({
  payload,
  appointmentId,
  description,
}: {
  payload: PayloadInstance
  appointmentId: number
  /** Причина: видна пациенту в выписке и нам в кабинете ЮKassa. */
  description: string
}): Promise<{ refunded: boolean; reason?: string }> {
  if (!isYooKassaConfigured()) return { refunded: false, reason: 'not_configured' }

  const appointment = await loadAppointment(payload, appointmentId)
  if (!appointment) return { refunded: false, reason: 'not_found' }

  const paymentId = appointment.payment?.paymentId
  // Запись без платежа — бесплатная или неоплаченная, возвращать нечего.
  if (!paymentId) return { refunded: false, reason: 'no_payment' }

  // Уже возвращено ранее: в ЮKassa не ходим.
  if (appointment.payment?.status === 'refunded') return { refunded: true }

  // Снимку статуса в БД не доверяем — читаем платёж напрямую.
  const payment = await getPayment(paymentId)

  // Деньги не дошли: pending/canceled возвращать нечего. Захолдированный
  // платёж (`waiting_for_capture`) отменит сверка брошенных платежей.
  if (payment.status !== 'succeeded') {
    return { refunded: false, reason: `payment_${payment.status}` }
  }

  const result = await refundLatePayment({
    payload,
    appointment,
    payment,
    snapshot: {
      status: toLocalStatus(payment),
      amount: parseYooKassaAmount(payment.amount),
      method: payment.payment_method?.type ?? null,
      checkedAt: new Date().toISOString(),
    },
    description,
  })

  return { refunded: result.refunded }
}

/**
 * Оплачен платёж, который записи уже не принадлежит.
 *
 * Так выглядит запоздавшее уведомление по отменённой попытке: в записи лежит
 * id другого (более свежего) платежа, и применять к ней этот исход нельзя —
 * иначе мы затрём актуальное состояние, а деньги останутся у нас.
 * Состояние записи не трогаем вообще, только возвращаем деньги.
 */
async function refundOrphanPayment(payment: YooKassaPayment): Promise<void> {
  if (payment.status !== 'succeeded' || isFullyRefunded(payment)) return

  console.warn('[v0][payments] оплата по неактуальной попытке — возвращаем деньги', {
    paymentId: payment.id,
    appointmentId: payment.metadata?.appointmentId,
    amount: parseYooKassaAmount(payment.amount),
  })

  await createRefund({
    paymentId: payment.id,
    amount: parseYooKassaAmount(payment.amount),
    // Ключ привязан к платежу, поэтому повторное уведомление не вернёт дважды.
    idempotenceKey: buildIdempotenceKey('appointment-refund', payment.id),
    description: 'Оплата поступила по устаревшей попытке бронирования',
  })
}

/**
 * Разобрать уведомление ЮKassa по id платежа.
 *
 * Запись ищется по `payment.paymentId` (есть индекс), а `metadata.appointmentId`
 * используется как резерв: если уведомление пришло раньше, чем мы успели
 * сохранить id платежа, по метаданным запись всё равно находится.
 *
 * Резерв применяется только когда в записи ещё нет id платежа или он совпадает
 * с пришедшим. Если там лежит другой платёж — это запоздавшее уведомление по
 * отменённой попытке: исход к записи не применяем, а деньги (если пришли)
 * возвращаем.
 */
export async function handlePaymentNotification({
  paymentId,
  metadataAppointmentId,
}: {
  paymentId: string
  metadataAppointmentId?: string | number | null
}): Promise<{ handled: boolean; result?: SyncResult }> {
  const payload = await getPayload({ config })

  const found = await payload.find({
    collection: 'appointments',
    where: { 'payment.paymentId': { equals: paymentId } },
    limit: 1,
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })

  let appointment = (found.docs[0] as AppointmentLike | undefined) ?? null

  if (!appointment && metadataAppointmentId !== undefined && metadataAppointmentId !== null) {
    const fallbackId = Number(metadataAppointmentId)

    if (Number.isFinite(fallbackId) && fallbackId > 0) {
      const candidate = await loadAppointment(payload, fallbackId)
      const storedPaymentId = candidate?.payment?.paymentId

      if (candidate && (!storedPaymentId || storedPaymentId === paymentId)) {
        appointment = candidate
      } else if (candidate) {
        // В записи другой платёж: этот к ней не относится.
        // Статусу из тела уведомления не доверяем — читаем платёж напрямую.
        const orphan = await getPayment(paymentId)

        console.warn('[v0][payments] уведомление по неактуальной попытке оплаты', {
          paymentId,
          appointmentId: candidate.id,
          storedPaymentId,
          status: orphan.status,
        })

        await refundOrphanPayment(orphan)
        return { handled: true }
      }
    }
  }

  if (!appointment) {
    console.warn('[v0][payments] уведомление о неизвестном платеже', { paymentId })
    return { handled: false }
  }

  // Статусу из тела уведомления не доверяем — читаем платёж напрямую.
  const payment = await getPayment(paymentId)

  const result = await applyPaymentOutcome({ payload, appointment, payment })
  return { handled: true, result }
}

/**
 * Как часто повторно сверять один и тот же брошенный платёж.
 *
 * Троттл считается по `payment.checkedAt`, который обновляет любая сверка.
 * Он нужен с двух сторон: не долбить ЮKassa по записи, которая может висеть
 * часами, и не крутить в логах вечный ретрай по записи, которую не удаётся
 * удалить (например, к ней успели привязать сообщение и FK не отпускает).
 */
const RECONCILE_RECHECK_MS = 10 * 60 * 1000

/** Максимум записей за один проход сверки. */
const RECONCILE_MAX_BATCH = 50

/**
 * Догнать судьбу платежей по уже отменённым броням.
 *
 * Зачем это нужно. Истёкшая бронь без платежа удаляется сразу, но бронь, по
 * которой пациент успел нажать «Оплатить», удалить нельзя: ссылка на оплату
 * осталась у него в браузере, и запись — единственная связь между платежом и
 * консультацией (см. `moneyKeepReason` в appointment-holds.ts). Такие записи
 * оседали в личном кабинете как «Отменена» навсегда: снять их мог только
 * вебхук ЮKassa, а если он не пришёл — никто.
 *
 * Что делает проход. Для каждой отменённой брони с живым платежом читает
 * платёж из ЮKassa и применяет фактический исход:
 *
 *  - `succeeded` — деньги всё-таки пришли (вебхук потерялся): `applyPaymentOutcome`
 *    возвращает их пациенту. Это главная страховка прохода — без него оплата по
 *    истёкшей броне могла молча остаться у нас;
 *  - `canceled` — платёж окончательно мёртв, запись больше ничего не связывает,
 *    и она удаляется;
 *  - `pending` — ждём. Отменить такой платёж через API нельзя (ЮKassa принимает
 *    отмену только для `waiting_for_capture`), поэтому запись остаётся до
 *    автоотмены на стороне ЮKassa, и следующий проход её подберёт;
 *  - `waiting_for_capture` — деньги захолдированы на карте. Отменяем платёж явно,
 *    чтобы снять холд, а не держать деньги пациента до автоотмены.
 *
 * Проход идемпотентен: и отмена, и возврат идут с ключом идемпотентности,
 * привязанным к платежу, поэтому повтор ничего не делает дважды.
 */
export async function reconcileAbandonedPayments({
  maxBatch = RECONCILE_MAX_BATCH,
}: { maxBatch?: number } = {}): Promise<{
  checked: number
  refunded: number
  deleted: number
}> {
  const stats = { checked: 0, refunded: 0, deleted: 0 }

  // Без ключей ЮKassa сверять нечем: getPayment всё равно упал бы 503.
  if (!isYooKassaConfigured()) return stats

  const payload = await getPayload({ config })
  const staleBefore = new Date(Date.now() - RECONCILE_RECHECK_MS).toISOString()

  const found = await payload.find({
    collection: 'appointments',
    where: {
      and: [
        { status: { equals: 'cancelled' } },
        // Незакрытые платежи плюс `succeeded`: по отменённой записи оплата
        // означает, что деньги ещё у нас. Так проход догоняет возврат, который
        // не удался при отмене врачом (ЮKassa была недоступна). `refunded`
        // здесь не нужен — по нему исход доведён до конца.
        { 'payment.status': { in: ['pending', 'waiting_for_capture', 'canceled', 'succeeded'] } },
        {
          or: [
            { 'payment.checkedAt': { exists: false } },
            { 'payment.checkedAt': { less_than: staleBefore } },
          ],
        },
      ],
    },
    // Второй запрос (SELECT COUNT) не нужен — считаем сами по docs.
    pagination: false,
    limit: maxBatch,
    depth: 0,
    overrideAccess: true,
  })

  // pagination: false в некоторых адаптерах игнорирует limit — страхуемся.
  for (const doc of found.docs.slice(0, maxBatch)) {
    const appointment = doc as unknown as AppointmentLike
    const paymentId = appointment.payment?.paymentId

    // Платежа нет — записью занимается обычный sweep, а не сверка.
    if (!paymentId) continue

    try {
      stats.checked += 1

      // Единственный статус, отмену которого ЮKassa принимает. Делаем это до
      // сверки, чтобы холд с карты снялся сразу, а не через 6 часов.
      if (appointment.payment?.status === 'waiting_for_capture') {
        try {
          await cancelPayment({
            paymentId,
            idempotenceKey: buildIdempotenceKey('appointment-cancel', paymentId),
          })
        } catch (err) {
          // Платёж мог уйти в succeeded между чтением и отменой — не страшно:
          // сверка ниже увидит оплату и вернёт деньги.
          console.error('[v0][payments] не удалось отменить платёж', {
            appointmentId: appointment.id,
            paymentId,
            error: err instanceof Error ? err.message : err,
          })
        }
      }

      // Источник правды — сам платёж в ЮKassa, а не наш снимок статуса.
      const result = await syncAppointmentPayment({ payload, appointmentId: appointment.id })
      if (result?.refunded) stats.refunded += 1

      // Состояние изменилось внутри sync — перечитываем, прежде чем решать
      // судьбу записи.
      const fresh = await loadAppointment(payload, appointment.id)
      if (!fresh) continue

      // Удалится только если платёж окончательно мёртв и денег за ним нет:
      // решение целиком внутри deleteReleasedHold.
      const removed = await deleteReleasedHold({
        payload,
        appointment: fresh as AppointmentMoneyState & { id: number },
      })

      if (removed) stats.deleted += 1
    } catch (err) {
      // Одна проблемная запись не должна ронять весь проход.
      console.error('[v0][payments] сверка брошенного платежа не удалась', {
        appointmentId: appointment.id,
        paymentId,
        error: err instanceof Error ? err.message : err,
      })
    }
  }

  return stats
}
