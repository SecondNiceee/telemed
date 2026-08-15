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

/**
 * Вернуть слот обратно в расписание врача.
 *
 * При создании записи слот удаляется из schedule (а пустой день вычищается целиком),
 * поэтому при отмене неоплаченной брони нужно не просто восстановить время,
 * но и при необходимости заново создать день.
 */
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
  const doctor = await payload.findByID({
    collection: 'doctors',
    id: doctorId,
    overrideAccess: true,
  })

  if (!doctor) return

  const schedule = (doctor.schedule || []) as DoctorScheduleDate[]
  const dayIndex = schedule.findIndex((day) => day.date === date)

  let updatedSchedule: DoctorScheduleDate[]

  if (dayIndex === -1) {
    // День был удалён целиком (в нём не осталось слотов) — создаём заново.
    updatedSchedule = [...schedule, { date, slots: [{ time }] }]
  } else {
    const day = schedule[dayIndex]
    const slots = day.slots || []

    // Идемпотентность: если слот уже на месте, ничего не дублируем.
    if (slots.some((slot) => slot.time === time)) return

    updatedSchedule = schedule.map((entry, index) =>
      index === dayIndex
        ? { ...entry, slots: [...slots, { time }].sort((a, b) => a.time.localeCompare(b.time)) }
        : entry,
    )
  }

  updatedSchedule.sort((a, b) => a.date.localeCompare(b.date))

  await payload.update({
    collection: 'doctors',
    id: doctorId,
    data: { schedule: updatedSchedule },
    overrideAccess: true,
  })
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

async function runSweep(doctorId?: number): Promise<number> {
  const payload = await getPayloadInstance()

  const expired = await payload.find({
    collection: 'appointments',
    where: {
      status: { equals: 'pending_payment' },
      paymentExpiresAt: { less_than: new Date().toISOString() },
      ...(doctorId ? { doctor: { equals: doctorId } } : {}),
    },
    // pagination: false убирает второй запрос (SELECT COUNT), который Payload
    // делает только чтобы посчитать totalDocs — он здесь не нужен.
    pagination: false,
    // id возвращается всегда; тянем минимум колонок — сами документы не нужны,
    // releaseHold перечитывает запись по id и заново проверяет статус.
    select: { status: true },
    depth: 0,
    overrideAccess: true,
  })

  let released = 0
  for (const appointment of expired.docs) {
    try {
      const ok = await releaseHold({ payload, appointmentId: appointment.id })
      if (ok) released += 1
    } catch (err) {
      console.error('Failed to release expired hold', appointment.id, err)
    }
  }

  return released
}

/**
 * Освободить все просроченные брони (пользователь закрыл вкладку и не оплатил).
 * Вызывается при чтении страниц записи, поэтому внешний cron не нужен.
 *
 * Запрос опирается на составной индекс (status, paymentExpiresAt) из коллекции
 * Appointments, поэтому в обычной ситуации (просрочек нет) стоит близко к нулю
 * независимо от размера таблицы.
 *
 * @returns количество освобождённых слотов
 */
export async function releaseExpiredHolds({
  doctorId,
}: { doctorId?: number } = {}): Promise<number> {
  const scope = doctorId ? `doctor:${doctorId}` : 'all'

  // Уже идёт такой же sweep — присоединяемся к нему вместо второго прохода.
  const inFlight = inFlightSweeps.get(scope)
  if (inFlight) return inFlight

  const last = lastSweepAt.get(scope) ?? 0
  if (Date.now() - last < SWEEP_THROTTLE_MS) return 0

  const sweep = runSweep(doctorId)
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
