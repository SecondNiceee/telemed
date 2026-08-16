import 'server-only'

import { getPayload } from 'payload'
import config from '@payload-config'
import {
  buildIdempotenceKey,
  createPayment,
  createRefund,
  getPayment,
  isYooKassaConfigured,
  parseYooKassaAmount,
  YooKassaError,
  type YooKassaPayment,
} from './yookassa'
import { releaseHold } from './appointment-holds'
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
 *  - если у записи уже есть незавершённый платёж, он перечитывается из ЮKassa
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

  if (appointment.payment?.status === 'succeeded' && appointment.status !== 'pending_payment') {
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
    return refundLatePayment({ payload, appointment, payment, snapshot: common })
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

    return refundLatePayment({ payload, appointment: fresh, payment, snapshot: common })
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
}: {
  payload: PayloadInstance
  appointment: AppointmentLike
  payment: YooKassaPayment
  snapshot: Partial<AppointmentPaymentState>
}): Promise<SyncResult> {
  // Уже возвращали — второй раз не нужно.
  if (appointment.payment?.refundId) {
    return { appointmentStatus: appointment.status, paymentStatus: 'refunded', refunded: true }
  }

  await savePayment({ payload, appointment, patch: snapshot })

  const amount = parseYooKassaAmount(payment.amount)

  console.warn('[v0][payments] оплата пришла после потери слота — возвращаем деньги', {
    appointmentId: appointment.id,
    paymentId: payment.id,
    amount,
  })

  const refund = await createRefund({
    paymentId: payment.id,
    amount,
    idempotenceKey: buildIdempotenceKey('appointment-refund', payment.id),
    description: 'Время консультации было занято до поступления оплаты',
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
 * Разобрать уведомление ЮKassa по id платежа.
 *
 * Запись ищется по `payment.paymentId` (есть индекс), а `metadata.appointmentId`
 * используется как резерв: если уведомление пришло раньше, чем мы успели
 * сохранить id платежа, по метаданным запись всё равно находится.
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
      appointment = await loadAppointment(payload, fallbackId)
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
