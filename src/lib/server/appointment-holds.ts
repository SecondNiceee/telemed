import 'server-only'

import { getPayload } from 'payload'
import config from '@payload-config'
import type { DoctorScheduleDate } from '@/lib/api/types'

type PayloadInstance = Awaited<ReturnType<typeof getPayload>>

async function getPayloadInstance(): Promise<PayloadInstance> {
  return getPayload({ config })
}

/** Извлечь числовой id из relationship-поля Payload. */
function toId(raw: unknown): number {
  return typeof raw === 'object' && raw !== null ? (raw as { id: number }).id : Number(raw)
}

/** Слот в расписании врача. */
type SlotRef = { date: string; time: string }

/**
 * Вернуть сразу несколько слотов в расписание одного врача.
 *
 * Расписание хранится одним JSON-полем, поэтому запись — это read-modify-write
 * всей строки doctors. Пачку слотов одного врача обязательно применять одним
 * update: N последовательных апдейтов одной и той же строки не только медленнее,
 * но и теряют изменения при параллельных sweep'ах.
 *
 * При создании записи слот удаляется из schedule (а пустой день вычищается целиком),
 * поэтому при отмене неоплаченной брони нужно не просто восстановить время,
 * но и при необходимости заново создать день.
 */
export async function restoreDoctorSlots({
  payload,
  doctorId,
  slots,
}: {
  payload: PayloadInstance
  doctorId: number
  slots: SlotRef[]
}): Promise<void> {
  if (slots.length === 0) return

  const doctor = await payload.findByID({
    collection: 'doctors',
    id: doctorId,
    depth: 0,
    overrideAccess: true,
  })

  if (!doctor) return

  const schedule = (doctor.schedule || []) as DoctorScheduleDate[]

  // Копия расписания, проиндексированная по дате: собираем все слоты пачки
  // в памяти и только потом пишем один раз.
  const byDate = new Map<string, DoctorScheduleDate>()
  for (const day of schedule) {
    byDate.set(day.date, { ...day, slots: [...(day.slots || [])] })
  }

  let changed = false

  for (const { date, time } of slots) {
    const day = byDate.get(date)

    if (!day) {
      // День был удалён целиком (в нём не осталось слотов) — создаём заново.
      byDate.set(date, { date, slots: [{ time }] })
      changed = true
      continue
    }

    // Идемпотентность: если слот уже на месте, ничего не дублируем.
    if ((day.slots || []).some((slot) => slot.time === time)) continue

    day.slots = [...(day.slots || []), { time }]
    changed = true
  }

  if (!changed) return

  const updatedSchedule = [...byDate.values()]
    .map((day) => ({
      ...day,
      slots: [...(day.slots || [])].sort((a, b) => a.time.localeCompare(b.time)),
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  await payload.update({
    collection: 'doctors',
    id: doctorId,
    data: { schedule: updatedSchedule },
    overrideAccess: true,
  })
}

/** Вернуть один слот в расписание врача. */
export async function restoreDoctorSlot({
  payload,
  doctorId,
  date,
  time,
}: {
  payload: PayloadInstance
  doctorId: number
  date: string
  time: string
}): Promise<void> {
  await restoreDoctorSlots({ payload, doctorId, slots: [{ date, time }] })
}

/**
 * Отменить неоплаченную бронь и вернуть слот врачу.
 * Возвращает false, если запись уже не в статусе «Ожидает оплаты».
 */
export async function releaseHold({
  payload,
  appointmentId,
}: {
  payload: PayloadInstance
  appointmentId: number
}): Promise<boolean> {
  const appointment = await payload.findByID({
    collection: 'appointments',
    id: appointmentId,
    overrideAccess: true,
  })

  if (!appointment || appointment.status !== 'pending_payment') return false

  await payload.update({
    collection: 'appointments',
    id: appointmentId,
    data: { status: 'cancelled' },
    overrideAccess: true,
  })

  await restoreDoctorSlot({
    payload,
    doctorId: toId(appointment.doctor),
    date: appointment.date,
    time: appointment.time,
  })

  return true
}

/**
 * Минимальный интервал между sweep'ами с одинаковым скоупом.
 *
 * Страницы, которые вызывают sweep, помечены force-dynamic, поэтому без троттла
 * пачка одновременных запросов (в т.ч. от ботов) даёт по запросу в БД на каждый.
 * Брони живут 15 минут, так что задержка в несколько секунд не влияет на UX.
 */
const SWEEP_THROTTLE_MS = 10_000

/** Время последнего завершённого sweep'а по скоупу. */
const lastSweepAt = new Map<string, number>()

/** Sweep'ы, выполняющиеся прямо сейчас — чтобы не дублировать работу. */
const inFlightSweeps = new Map<string, Promise<number>>()

/**
 * Максимум броней за один проход.
 *
 * Sweep выполняется внутри рендера страницы, поэтому у него должен быть предел:
 * без него после долгого простоя накопившиеся просрочки уводят в таймаут
 * случайного пользователя. Остаток разберёт следующий заход (брони уже просрочены,
 * задержка на них не влияет).
 */
const SWEEP_MAX_BATCH = 100

type SweepScope = { doctorId?: number; userId?: number }

async function runSweep({ doctorId, userId }: SweepScope): Promise<number> {
  const payload = await getPayloadInstance()

  const expired = await payload.find({
    collection: 'appointments',
    where: {
      status: { equals: 'pending_payment' },
      paymentExpiresAt: { less_than: new Date().toISOString() },
      ...(doctorId ? { doctor: { equals: doctorId } } : {}),
      ...(userId ? { user: { equals: userId } } : {}),
    },
    // pagination: false убирает второй запрос (SELECT COUNT), который Payload
    // делает только чтобы посчитать totalDocs — он здесь не нужен.
    pagination: false,
    limit: SWEEP_MAX_BATCH,
    // Тянем ровно то, что нужно для восстановления слота, — без повторного
    // findByID на каждую бронь.
    select: { doctor: true, date: true, time: true },
    depth: 0,
    overrideAccess: true,
  })

  // pagination: false в некоторых адаптерах игнорирует limit — страхуемся.
  const batch = expired.docs.slice(0, SWEEP_MAX_BATCH)
  if (batch.length === 0) return 0

  // Один UPDATE ... WHERE id IN (...) вместо N апдейтов. Повторная проверка
  // статуса в where отсекает брони, которые успели оплатить между find и update.
  const cancelled = await payload.update({
    collection: 'appointments',
    where: {
      id: { in: batch.map((appointment) => appointment.id) },
      status: { equals: 'pending_payment' },
    },
    data: { status: 'cancelled' },
    depth: 0,
    overrideAccess: true,
  })

  for (const error of cancelled.errors ?? []) {
    console.error('Failed to cancel expired hold', error)
  }

  const cancelledIds = new Set((cancelled.docs ?? []).map((doc) => doc.id))
  if (cancelledIds.size === 0) return 0

  // Группируем слоты по врачу: одна строка doctors — один update,
  // сколько бы броней у этого врача ни просрочилось.
  const slotsByDoctor = new Map<number, SlotRef[]>()

  for (const appointment of batch) {
    if (!cancelledIds.has(appointment.id)) continue

    const id = toId(appointment.doctor)
    if (!Number.isFinite(id)) continue

    const slots = slotsByDoctor.get(id) ?? []
    slots.push({ date: appointment.date, time: appointment.time })
    slotsByDoctor.set(id, slots)
  }

  for (const [id, slots] of slotsByDoctor) {
    try {
      await restoreDoctorSlots({ payload, doctorId: id, slots })
    } catch (err) {
      console.error('Failed to restore slots for doctor', id, err)
    }
  }

  return cancelledIds.size
}

/**
 * Освободить все просроченные брони (пользователь закрыл вкладку и не оплатил).
 * Вызывается при чтении страниц записи, поэтому внешний cron не нужен.
 *
 * Запрос опирается на составной индекс (status, paymentExpiresAt) из коллекции
 * Appointments, поэтому в обычной ситуации (просрочек нет) стоит близко к нулю
 * независимо от размера таблицы.
 *
 * Скоуп стоит сужать всегда, когда он известен: `doctorId` — для страницы врача,
 * `userId` — для личного кабинета. Без аргументов проход идёт по всей таблице,
 * то есть один пользователь чинит брони всех остальных.
 *
 * @returns количество освобождённых слотов
 */
export async function releaseExpiredHolds({
  doctorId,
  userId,
}: SweepScope = {}): Promise<number> {
  const scope = doctorId ? `doctor:${doctorId}` : userId ? `user:${userId}` : 'all'

  // Уже идёт такой же sweep — присоединяемся к нему вместо второго прохода.
  const inFlight = inFlightSweeps.get(scope)
  if (inFlight) return inFlight

  const last = lastSweepAt.get(scope) ?? 0
  if (Date.now() - last < SWEEP_THROTTLE_MS) return 0

  const sweep = runSweep({ doctorId, userId })
    .catch((err) => {
      console.error('Failed to release expired holds:', err)
      return 0
    })
    .finally(() => {
      lastSweepAt.set(scope, Date.now())
      inFlightSweeps.delete(scope)
    })

  inFlightSweeps.set(scope, sweep)
  return sweep
}

/**
 * Прочитать актуальное расписание врача напрямую из БД, минуя тегированный кеш.
 * Нужно сразу после освобождения слотов, чтобы страница показала их доступными.
 */
export async function getFreshDoctorSchedule(doctorId: number): Promise<DoctorScheduleDate[]> {
  try {
    const payload = await getPayloadInstance()
    const doctor = await payload.findByID({
      collection: 'doctors',
      id: doctorId,
      depth: 0,
      overrideAccess: true,
    })
    return ((doctor?.schedule || []) as DoctorScheduleDate[]) ?? []
  } catch (err) {
    console.error('Failed to read fresh doctor schedule:', err)
    return []
  }
}
