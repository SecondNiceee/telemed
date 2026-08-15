import type { PayloadRequest } from 'payload'
import { getPaymentDeadline } from '@/lib/constants/payment'

/**
 * Серверная валидация создания записи.
 *
 * Записи создаются через нативный REST-эндпоинт Payload (`POST /api/appointments`),
 * то есть тело запроса полностью контролируется клиентом. Без этого guard'а
 * пациент может прислать свою цену, чужой `user`, сразу `status: 'confirmed'`
 * (полный обход оплаты) или бесконечный `paymentExpiresAt`.
 *
 * Правило: всё, что влияет на деньги, владельца и срок брони, считает сервер.
 * Клиентские значения этих полей игнорируются.
 */

/** Сколько неоплаченных броней одновременно может держать один пациент. */
export const MAX_ACTIVE_HOLDS = 2

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

/** Максимальная длина текстовых «снимков» (попадают в письма). */
const TEXT_MAX = 200

type ScheduleDay = { date?: string | null; slots?: ({ time?: string | null } | null)[] | null }

/** Извлечь числовой id из relationship-поля Payload (populated | string | number). */
function toId(raw: unknown): number {
  return typeof raw === 'object' && raw !== null ? Number((raw as { id: unknown }).id) : Number(raw)
}

/** Дата «сегодня» в локальной зоне сервера в формате YYYY-MM-DD. */
function todayStr(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function sanitizeText(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const trimmed = raw.trim().slice(0, TEXT_MAX)
  return trimmed.length > 0 ? trimmed : undefined
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

  // Записи через админку (админ) и доверенные серверные вызовы Local API
  // (нет req.user, overrideAccess) оставляем как есть.
  if (!caller || caller.collection !== 'users') return data
  if ((caller as { role?: string }).role === 'admin') return data

  const userId = Number(caller.id)

  // --- Владелец записи: всегда владелец токена, а не тот, кого прислал клиент.
  data.user = userId

  // --- Формат даты и времени.
  const date = typeof data.date === 'string' ? data.date : ''
  const time = typeof data.time === 'string' ? data.time : ''

  if (!DATE_RE.test(date)) throw new Error('Некорректная дата записи.')
  if (!TIME_RE.test(time)) throw new Error('Некорректное время записи.')
  if (date < todayStr()) throw new Error('Нельзя записаться на прошедшую дату.')

  // --- Врач должен существовать.
  const doctorId = toId(data.doctor)
  if (!Number.isFinite(doctorId) || doctorId <= 0) throw new Error('Врач не найден.')

  const doctor = await req.payload.findByID({
    collection: 'doctors',
    id: doctorId,
    depth: 0,
    overrideAccess: true,
  })

  if (!doctor) throw new Error('Врач не найден.')

  // --- Слот должен реально существовать в расписании врача.
  // Иначе можно записаться на время, которое врач никогда не открывал.
  const schedule = (doctor.schedule || []) as ScheduleDay[]
  const slotExists = schedule.some(
    (day) => day?.date === date && (day.slots || []).some((slot) => slot?.time === time),
  )

  if (!slotExists) {
    throw new Error('Это время недоступно для записи. Обновите страницу и выберите другое.')
  }

  // --- Цена: только из карточки врача. Клиентское значение игнорируем.
  data.price = doctor.price ?? 0

  // --- Статус и срок брони считает сервер: новая запись всегда неоплаченная.
  data.status = 'pending_payment'
  data.paymentExpiresAt = getPaymentDeadline().toISOString()
  data.paidAt = null

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
    throw new Error(
      'У вас уже есть неоплаченные брони. Завершите или отмените их, прежде чем записываться снова.',
    )
  }

  // --- Текстовые «снимки» для отображения и писем: имена берём из БД.
  data.doctorName = doctor.name || 'Врач'

  try {
    const user = await req.payload.findByID({
      collection: 'users',
      id: userId,
      depth: 0,
      overrideAccess: true,
    })
    data.userName = user?.name || user?.email || 'Пациент'
  } catch {
    data.userName = sanitizeText(data.userName) || 'Пациент'
  }

  data.specialty = sanitizeText(data.specialty) || ''

  return data
}
