import { APIError, type PayloadRequest } from 'payload'
import { getPaymentDeadline } from '@/lib/constants/payment'
import { isScheduleSlotFuture, SLOT_UNAVAILABLE_MESSAGE } from '@/lib/schedule-time'

/**
 * Серверная валидация создания записи.
 *
 * Записи создаются через нативный REST-эндпоинт Payload (`POST /api/appointments`),
 * то есть тело запроса полностью контролируется клиентом. Без этого guard'а
 * пациент может прислать свою цену, чужой `user`, сразу `status: 'confirmed'`
 * (полный обход оплаты) или бесконечный `paymentExpiresAt`.
 *
 * Правила:
 *  1. Whitelist полей. Всё, что не входит в список разрешённых для этого типа
 *     вызывающего, вырезается из `data` до записи в БД — независимо от роли.
 *  2. Всё, что влияет на деньги, владельца и срок брони, считает сервер.
 *  3. Роль `admin` не выключает guard'ы целиком: у админки просто более широкий
 *     whitelist, но формат данных и существование связей проверяются всегда.
 *  4. Роль берётся из БД, а не из claim'а токена.
 */

/** Сколько неоплаченных броней одновременно может держать один пациент. */
export const MAX_ACTIVE_HOLDS = 2

/**
 * Единый текст ошибки для занятого слота.
 *
 * Используется и предварительной проверкой в beforeChange, и обработчиком
 * нарушения уникального индекса (afterError), чтобы пользователь видел одно
 * и то же сообщение независимо от того, кто поймал конфликт.
 */
export const SLOT_TAKEN_MESSAGE = SLOT_UNAVAILABLE_MESSAGE

/**
 * Имя частичного уникального индекса на слот.
 * Создаётся миграцией src/migrations/20260815_000000_appointments_slot_unique.ts.
 *
 * Значение намеренно продублировано в миграции литералом: миграции — это
 * замороженный снимок схемы, они не должны меняться вслед за константой в коде.
 */
export const SLOT_UNIQUE_INDEX = 'appointments_slot_unique'

/**
 * Ошибка валидации, текст которой дойдёт до пользователя.
 *
 * Обычный `new Error(...)` для этого не годится: у него нет ни `status`, ни
 * `isPublic`, поэтому Payload считает его внутренней ошибкой и подменяет ответ
 * на безликое «Something went wrong.» (см. utilities/routeError.js +
 * utilities/isErrorPublic.js). Именно из-за этого второй пациент, пытавшийся
 * занять уже забронированный слот, видел 500 вместо объяснения.
 *
 * `isPublic: true` разрешает отдать наш текст как есть — он для этого и написан,
 * секретов в нём нет. Статус по умолчанию 409: почти все проверки здесь — это
 * конфликт с текущим состоянием (слот занят, лимит броней исчерпан).
 */
export function bookingError(message: string, status = 409): APIError {
  return new APIError(message, status, null, true)
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

/** Максимальная длина текстовых «снимков» (попадают в письма). */
const TEXT_MAX = 200

const STATUS_VALUES = new Set([
  'pending_payment',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
])

const CONNECTION_TYPES = new Set(['chat', 'audio', 'video'])

/**
 * Единственные поля, которые пациент вправе прислать при создании записи.
 * Всё остальное — `user`, `price`, `status`, `paymentExpiresAt`, `paidAt`,
 * `doctorName`, `userName`, `chatBlocked`, `recording`, `activeCall` —
 * заполняет сервер, поэтому клиентские значения вырезаются.
 */
const PATIENT_WRITABLE_FIELDS = new Set(['doctor', 'date', 'time', 'specialty', 'connectionType'])

/**
 * Поля, доступные админке. Шире, чем у пациента (админ действительно может
 * создать запись за пациента и сразу пометить её оплаченной), но это всё ещё
 * закрытый список: неизвестные и служебные поля не проходят.
 */
const ADMIN_WRITABLE_FIELDS = new Set([
  'doctor',
  'user',
  'date',
  'time',
  'specialty',
  'connectionType',
  'price',
  'status',
  'paymentExpiresAt',
  'paidAt',
  'doctorName',
  'userName',
  'chatBlocked',
  'recording',
])

/**
 * Поля, которые врач вправе менять в СВОЕЙ записи.
 *
 * Здесь нет ни `price`, ни `paidAt`, ни `status: 'confirmed'`, ни `user`/`doctor`/
 * `date`/`time`: иначе врач через нативный `PATCH /api/appointments/{id}` мог бы
 * пометить свою запись оплаченной или переписать её на другого пациента.
 */
const DOCTOR_UPDATABLE_FIELDS = new Set(['status', 'chatBlocked', 'recording', 'activeCall'])

/**
 * Статусы, в которые врач вправе перевести запись.
 *
 * `confirmed` недоступен намеренно — подтверждение делает только оплата.
 * `cancelled` тоже: отмена возвращает слот в расписание, это делает releaseHold.
 */
const DOCTOR_ALLOWED_STATUSES = new Set(['in_progress', 'completed'])

/**
 * Из каких статусов врач вправе двигать запись.
 * Неоплаченную бронь (`pending_payment`) врач не трогает вообще, иначе перевод
 * в `in_progress` стал бы обходом оплаты.
 */
const DOCTOR_UPDATABLE_FROM_STATUSES = new Set(['confirmed', 'in_progress'])

/** Поля, которые админка вправе менять у существующей записи. */
const ADMIN_UPDATABLE_FIELDS = new Set([...ADMIN_WRITABLE_FIELDS, 'activeCall'])

type ScheduleDay = { date?: string | null; slots?: ({ time?: string | null } | null)[] | null }

/** Извлечь числовой id из relationship-поля Payload (populated | string | number). */
function toId(raw: unknown): number {
  return typeof raw === 'object' && raw !== null ? Number((raw as { id: unknown }).id) : Number(raw)
}

function sanitizeText(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const trimmed = raw.trim().slice(0, TEXT_MAX)
  return trimmed.length > 0 ? trimmed : undefined
}

/** Валидная ISO-дата или undefined. */
function sanitizeDate(raw: unknown): string | undefined {
  if (typeof raw !== 'string' && !(raw instanceof Date)) return undefined
  const parsed = new Date(raw as string)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
}

/**
 * Вырезать из `data` всё, что не входит в whitelist.
 * Возвращает имена отброшенных полей ��� полезно для логов.
 */
function stripToWhitelist(data: Record<string, unknown>, allowed: Set<string>): string[] {
  const dropped: string[] = []

  for (const key of Object.keys(data)) {
    if (allowed.has(key)) continue
    // id/служебные поля Payload не трогаем: их выставляет не клиент.
    if (key === 'id' || key === 'createdAt' || key === 'updatedAt') continue
    dropped.push(key)
    delete data[key]
  }

  return dropped
}

/**
 * Вернуть поля вне whitelist к их текущим значениям в БД.
 *
 * Для update нельзя просто удалять поля из `data`, как это делается при create:
 * в зависимости от пути вызова Payload может писать документ целиком, и тогда
 * удалённое поле обнулилось бы в БД. Поэтому запрещённое поле не вырезается,
 * а откатывается к значению из `originalDoc` — попытка изменения просто
 * не даёт эффекта.
 *
 * Возваащает имена полей, попытку изменить которые мы отклонили.
 */
function revertToOriginal(
  data: Record<string, unknown>,
  allowed: Set<string>,
  originalDoc: Record<string, unknown> | undefined,
): string[] {
  const reverted: string[] = []

  for (const key of Object.keys(data)) {
    if (allowed.has(key)) continue
    if (key === 'id' || key === 'createdAt' || key === 'updatedAt') continue

    const current = originalDoc?.[key]

    // Значение и так совпадает с текущим — это не попытка изменения.
    if (JSON.stringify(current ?? null) === JSON.stringify(data[key] ?? null)) continue

    reverted.push(key)

    if (originalDoc && key in originalDoc) {
      data[key] = current
    } else {
      delete data[key]
    }
  }

  return reverted
}

/**
 * Проверить роль по БД, а не по claim'у в токене.
 * Даже валидный токен несёт снимок роли на момент логина, поэтому решение
 * «это админ» принимаем только после сверки с актуальной записью.
 */
async function isVerifiedAdmin(req: PayloadRequest, userId: number): Promise<boolean> {
  const claimedRole = (req.user as { role?: string } | null | undefined)?.role
  if (claimedRole !== 'admin') return false

  try {
    const user = await req.payload.findByID({
      collection: 'users',
      id: userId,
      depth: 0,
      overrideAccess: true,
    })
    return user?.role === 'admin'
  } catch {
    return false
  }
}

/** Имя пациента из БД. */
async function resolveUserName(req: PayloadRequest, userId: number): Promise<string> {
  try {
    const user = await req.payload.findByID({
      collection: 'users',
      id: userId,
      depth: 0,
      overrideAccess: true,
    })
    return user?.name || user?.email || 'Пациент'
  } catch {
    return 'Пациент'
  }
}

/** Врач из БД или ошибка. */
async function requireDoctor(req: PayloadRequest, raw: unknown) {
  const doctorId = toId(raw)
  if (!Number.isFinite(doctorId) || doctorId <= 0) throw bookingError('Врач не найден.', 404)

  const doctor = await req.payload.findByID({
    collection: 'doctors',
    id: doctorId,
    depth: 0,
    overrideAccess: true,
  })

  if (!doctor) throw bookingError('Врач не найден.', 404)
  return doctor
}

/**
 * Привести данные новой записи к доверенному виду.
 * Мутирует и возвращает `data`.
 *
 * @throws Error с текстом для пользователя, если бронь недопустима.
 */
export async function applyBookingGuards({
  data,
  req,
}: {
  data: Record<string, unknown>
  req: PayloadRequest
}): Promise<Record<string, unknown>> {
  const caller = req.user

  // Доверенный серверный вызов Local API (сиды, миграции, наши роуты):
  // нет пользователя и запрос не пришёл по HTTP.
  if (!caller && req.payloadAPI === 'local') return data

  // Всё остальное — внешний запрос. Аноним и не-пациентские токены
  // (врач, организация) записи не создают.
  if (!caller || caller.collection !== 'users') {
    throw bookingError('Создавать записи может только авторизованный пациент.', 403)
  }

  const callerId = Number(caller.id)
  if (!Number.isFinite(callerId) || callerId <= 0) {
    throw bookingError('Создавать записи может только авторизованный пациент.', 403)
  }

  const admin = await isVerifiedAdmin(req, callerId)

  // Шаг 1 (всегда): вырезаем всё вне whitelist.
  const dropped = stripToWhitelist(data, admin ? ADMIN_WRITABLE_FIELDS : PATIENT_WRITABLE_FIELDS)
  if (dropped.length > 0) {
    console.warn(
      `[appointments] игнорирую поля вне whitelist от ${admin ? 'admin' : 'user'} ${callerId}: ${dropped.join(', ')}`,
    )
  }

  // Шаг 2 (всегда): формат даты и времени.
  const date = typeof data.date === 'string' ? data.date : ''
  const time = typeof data.time === 'string' ? data.time : ''

  if (!DATE_RE.test(date)) throw bookingError('Некорректная дата записи.', 400)
  if (!TIME_RE.test(time)) throw bookingError('Некорректное время записи.', 400)

  // Шаг 3 (всегда): врач должен существовать.
  const doctor = await requireDoctor(req, data.doctor)
  data.doctor = doctor.id
  data.doctorName = doctor.name || 'Врач'

  // Шаг 4 (всегда): вид связи только из допустимого набора.
  // Молча подменять на 'chat' нельзя: пациент выбрал видео, а получил бы чат.
  if (data.connectionType === undefined || data.connectionType === null) {
    data.connectionType = 'chat'
  } else if (!CONNECTION_TYPES.has(data.connectionType as string)) {
    throw bookingError('Некорректный вид связи.', 400)
  }

  data.specialty = sanitizeText(data.specialty) || ''

  if (admin) {
    return await applyAdminGuards({ data, req, doctor })
  }

  return await applyPatientGuards({ data, req, doctor, userId: callerId, date, time })
}

/**
 * Серверная валидация ИЗМЕНЕНИЯ записи.
 *
 * `access.update` пускает сюда админа (любая запись) и врача (только свои),
 * но сам по себе не ограничивает НАБОР полей. Без этого guard'а врач мог бы
 * через нативный `PATCH /api/appointments/{id}` выставить своей записи
 * `status: 'confirmed'` + `paidAt` (обход оплаты), обнулить `price` или
 * переписать `date`/`time`/`user`.
 *
 * Пациент сюда не попадает: для него `access.update` возвращает false.
 *
 * @throws Error с текстом для пользователя, если изменение недопустимо.
 */
export async function applyUpdateGuards({
  data,
  req,
  originalDoc,
}: {
  data: Record<string, unknown>
  req: PayloadRequest
  originalDoc?: Record<string, unknown>
}): Promise<Record<string, unknown>> {
  const caller = req.user

  // Доверенный серверный вызов Local API: наши роуты (/pay, /release, /complete),
  // socket-обработчики звонков и чата, sweep просроченных броней. Все они уже
  // проверили права до вызова payload.update.
  if (!caller && req.payloadAPI === 'local') return data

  if (!caller) throw bookingError('Недостаточно прав для изменения записи.', 403)

  // --- Врач: узкий whitelist, статус только вперёд по ходу консультации.
  if (caller.collection === 'doctors') {
    const doctorId = Number(caller.id)
    const ownerId = toId(originalDoc?.doctor)

    if (!Number.isFinite(doctorId) || doctorId !== ownerId) {
      throw bookingError('Недостаточно прав для изменения записи.', 403)
    }

    const reverted = revertToOriginal(data, DOCTOR_UPDATABLE_FIELDS, originalDoc)
    if (reverted.length > 0) {
      console.warn(
        `[appointments] отклоняю изменение полей от doctor ${doctorId}: ${reverted.join(', ')}`,
      )
    }

    if ('status' in data && data.status !== originalDoc?.status) {
      const currentStatus = String(originalDoc?.status ?? '')

      if (!DOCTOR_UPDATABLE_FROM_STATUSES.has(currentStatus)) {
        throw bookingError('Статус этой записи нельзя изменить.', 400)
      }
      if (!DOCTOR_ALLOWED_STATUSES.has(data.status as string)) {
        throw bookingError('Недопустимый статус записи.', 400)
      }
    }

    if ('chatBlocked' in data) data.chatBlocked = data.chatBlocked === true

    return data
  }

  // --- Админ: широкий whitelist, но значения нормализуются.
  if (caller.collection === 'users') {
    const callerId = Number(caller.id)

    if (!(await isVerifiedAdmin(req, callerId))) {
      throw bookingError('Недостаточно прав для изменения записи.', 403)
    }

    const reverted = revertToOriginal(data, ADMIN_UPDATABLE_FIELDS, originalDoc)
    if (reverted.length > 0) {
      console.warn(
        `[appointments] отклоняю изменение полей от admin ${callerId}: ${reverted.join(', ')}`,
      )
    }

    if ('status' in data && !STATUS_VALUES.has(data.status as string)) {
      throw bookingError('Недопустимый статус записи.', 400)
    }

    if ('price' in data) {
      const rawPrice = Number(data.price)
      if (!Number.isFinite(rawPrice) || rawPrice < 0) {
        throw bookingError('Некорректная стоимость.', 400)
      }
      data.price = rawPrice
    }

    if ('paidAt' in data) data.paidAt = sanitizeDate(data.paidAt) ?? null
    if ('paymentExpiresAt' in data) {
      data.paymentExpiresAt = sanitizeDate(data.paymentExpiresAt) ?? null
    }
    if ('chatBlocked' in data) data.chatBlocked = data.chatBlocked === true

    return data
  }

  throw bookingError('Недостаточно прав для изменения записи.', 403)
}

/**
 * Нарушение частичного уникального индекса на слот (двойная бронь).
 *
 * Постгресовая ошибка приходит завёрнутой (drizzle → payload), поэтому проверяем
 * и саму ошибку, и её `cause`.
 */
export function isSlotConflictError(error: unknown): boolean {
  const seen = new Set<unknown>()
  let current: unknown = error

  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)

    const err = current as { code?: unknown; constraint?: unknown; message?: unknown; cause?: unknown }

    const isUniqueViolation = String(err.code ?? '') === '23505'
    const mentionsIndex =
      String(err.constraint ?? '').includes(SLOT_UNIQUE_INDEX) ||
      String(err.message ?? '').includes(SLOT_UNIQUE_INDEX)

    if (isUniqueViolation && mentionsIndex) return true
    // Некоторые обёртки теряют code, но сохраняют имя индекса в тексте.
    if (mentionsIndex) return true

    current = err.cause
  }

  return false
}

/**
 * Ветка админки: широкий whitelist, но данные всё равно нормализуются.
 * Слот вне расписания и произвольный статус разрешены осознанно —
 * админ заводит записи вручную.
 */
async function applyAdminGuards({
  data,
  req,
  doctor,
}: {
  data: Record<string, unknown>
  req: PayloadRequest
  doctor: { id: number | string; price?: number | null }
}): Promise<Record<string, unknown>> {
  // Пациент обязателен и должен существовать.
  const userId = toId(data.user)
  if (!Number.isFinite(userId) || userId <= 0) {
    throw bookingError('Укажите пациента для записи.', 400)
  }

  const patient = await req.payload
    .findByID({ collection: 'users', id: userId, depth: 0, overrideAccess: true })
    .catch(() => null)

  if (!patient) throw bookingError('Пациент не найден.', 404)

  data.user = patient.id
  data.userName = sanitizeText(data.userName) || patient.name || patient.email || 'Пациент'

  // Статус — только из enum.
  const status = STATUS_VALUES.has(data.status as string) ? (data.status as string) : 'confirmed'
  data.status = status

  // Цена — неотрицательное число; по умолчанию из карточки врача.
  const rawPrice = Number(data.price)
  data.price = Number.isFinite(rawPrice) && rawPrice >= 0 ? rawPrice : (doctor.price ?? 0)

  // Срок брони нужен только неоплаченной записи.
  if (status === 'pending_payment') {
    data.paymentExpiresAt = sanitizeDate(data.paymentExpiresAt) || getPaymentDeadline().toISOString()
    data.paidAt = null
  } else {
    data.paymentExpiresAt = null
    data.paidAt = sanitizeDate(data.paidAt) ?? null
  }

  data.chatBlocked = data.chatBlocked === true

  return data
}

/**
 * Ветка пациента: деньги, владелец, статус и срок брони — только с сервера,
 * плюс проверка реального слота и лимита активных броней.
 */
async function applyPatientGuards({
  data,
  req,
  doctor,
  userId,
  date,
  time,
}: {
  data: Record<string, unknown>
  req: PayloadRequest
  doctor: { schedule?: unknown; price?: number | null }
  userId: number
  date: string
  time: string
}): Promise<Record<string, unknown>> {
  // Сервер повторно проверяет порог непосредственно перед созданием записи:
  // устаревшая вкладка не сможет забронировать слот, до которого осталось менее 30 минут.
  if (!isScheduleSlotFuture(date, time)) {
    throw bookingError(SLOT_TAKEN_MESSAGE)
  }

  // --- Владелец записи: всегда владелец токена, а не тот, кого прислал клиент.
  data.user = userId

  // --- Слот должен реально существовать в расписании врача.
  // Иначе можно записаться на время, которое врач никогда не открывал.
  const schedule = (doctor.schedule || []) as ScheduleDay[]
  const slotExists = schedule.some(
    (day) => day?.date === date && (day.slots || []).some((slot) => slot?.time === time),
  )

  if (!slotExists) {
    throw bookingError(SLOT_TAKEN_MESSAGE)
  }

  // --- Цена: только из карточки врача. Клиентское значение уже вырезано.
  data.price = doctor.price ?? 0

  // --- Статус и срок брони считает сервер: новая запись всегда неоплаченная.
  data.status = 'pending_payment'
  data.paymentExpiresAt = getPaymentDeadline().toISOString()
  data.paidAt = null

  // --- Служебные поля стартуют в известном состоянии (клиентские вырезаны).
  data.chatBlocked = false
  data.recording = null

  // --- Ограничение на число одновременных броней (иначе один аккаунт
  // в цикле выкупает всё расписание врача на 15 минут).
  const activeHolds = await req.payload.count({
    collection: 'appointments',
    where: {
      user: { equals: userId },
      status: { equals: 'pending_payment' },
      paymentExpiresAt: { greater_than: new Date().toISOString() },
    },
    overrideAccess: true,
  })

  if (activeHolds.totalDocs >= MAX_ACTIVE_HOLDS) {
    throw bookingError(
      'У вас уже есть неоплаченные брони. Завершите или отмените их, прежде чем записываться снова.',
    )
  }

  // --- Имя пациента для отображения и писем: только из БД.
  data.userName = await resolveUserName(req, userId)

  return data
}
