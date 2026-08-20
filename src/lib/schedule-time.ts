const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

export const BOOKING_LEAD_TIME_MINUTES = 30
export const BOOKING_LEAD_TIME_MS = BOOKING_LEAD_TIME_MINUTES * 60 * 1000
export const SLOT_UNAVAILABLE_MESSAGE = 'Консультация была выбрана другим пользователем'
export const SCHEDULE_SLOT_TOO_SOON_MESSAGE = `Время приёма должно быть не раньше, чем через ${BOOKING_LEAD_TIME_MINUTES} минут`

export interface ScheduleEntryLike {
  date: string
  slots?: Array<{ time: string } | null> | null
}

export function getScheduleSlotDate(date: string, time: string): Date | null {
  const dateMatch = DATE_PATTERN.exec(date)
  const timeMatch = TIME_PATTERN.exec(time)
  if (!dateMatch || !timeMatch) return null

  const year = Number(dateMatch[1])
  const month = Number(dateMatch[2])
  const day = Number(dateMatch[3])
  const hours = Number(timeMatch[1])
  const minutes = Number(timeMatch[2])
  const value = new Date(year, month - 1, day, hours, minutes, 0, 0)

  if (
    value.getFullYear() !== year ||
    value.getMonth() !== month - 1 ||
    value.getDate() !== day ||
    value.getHours() !== hours ||
    value.getMinutes() !== minutes
  ) {
    return null
  }

  return value
}

/** A patient can book only while at least 30 full minutes remain before the slot. */
export function isScheduleSlotFuture(date: string, time: string, now = new Date()): boolean {
  const slotDate = getScheduleSlotDate(date, time)
  return slotDate !== null && slotDate.getTime() - now.getTime() >= BOOKING_LEAD_TIME_MS
}

export function filterFutureSchedule<T extends ScheduleEntryLike>(
  schedule: T[] | null | undefined,
  now = new Date(),
): T[] {
  if (!schedule) return []

  return schedule.flatMap((entry) => {
    const slots = (entry.slots ?? []).filter(
      (slot): slot is NonNullable<typeof slot> =>
        slot !== null && isScheduleSlotFuture(entry.date, slot.time, now),
    )

    return slots.length > 0 ? [{ ...entry, slots } as T] : []
  })
}
