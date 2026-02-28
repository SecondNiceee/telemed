import type { DoctorScheduleSlot } from "@/lib/api/types"

export const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
]

export const WEEKDAY_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]

export const SLOT_DURATION_OPTIONS = [
  { value: "20", label: "20 мин" },
  { value: "30", label: "30 мин" },
  { value: "40", label: "40 мин" },
  { value: "60", label: "1 час" },
]

export function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, m - 1, d)
}

export function formatDateShort(s: string): string {
  const d = parseDate(s)
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3).toLowerCase()}`
}

export function formatDateFull(s: string): string {
  const d = parseDate(s)
  const dayNames = [
    "воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота",
  ]
  return `${dayNames[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()].toLowerCase()} ${d.getFullYear()}`
}

export function getMonthDays(year: number, month: number): Date[] {
  const days: Date[] = []
  const d = new Date(year, month, 1)
  while (d.getMonth() === month) {
    days.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return days
}

/** Monday=0 ... Sunday=6 */
export function getMondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7
}

export function sortSlots(slots: DoctorScheduleSlot[]): DoctorScheduleSlot[] {
  return [...slots].sort((a, b) => a.time.localeCompare(b.time))
}
