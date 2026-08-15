import type { DoctorScheduleDate } from '@/lib/api/types'

/**
 * Есть ли у врача хоть какое-то расписание.
 *
 * Длительность консультации имеет смысл показывать пациенту только если врач
 * реально выставил слоты: без расписания записаться нельзя, и «30 минут»
 * рядом с врачом без слотов вводит в заблуждение.
 */
export function hasAnySchedule(schedule?: DoctorScheduleDate[] | null): boolean {
  if (!Array.isArray(schedule)) return false
  return schedule.some((day) => Array.isArray(day?.slots) && day.slots.length > 0)
}

/**
 * Длительность одного слота в минутах.
 *
 * slotDuration в Payload — строковый select ('15' | '30' | ... ), поэтому
 * приводим к числу. Если значение не задано или битое — используем дефолт
 * коллекции Doctors (30 минут).
 */
export function getSlotDurationMinutes(slotDuration?: string | number | null): number {
  const parsed =
    typeof slotDuration === 'number' ? slotDuration : Number.parseInt(String(slotDuration ?? ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30
}

/** «30 минут» / «1 ч» / «1 ч 30 мин» — человекочитаемая длительность. */
export function formatDurationRu(minutes: number): string {
  if (minutes < 60) return `${minutes} минут`

  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} ч` : `${hours} ч ${rest} мин`
}

/**
 * Итоговая подпись «Время консультации» для врача.
 * Возвращает null, если расписания нет — тогда блок просто не рендерим.
 */
export function getConsultationDurationLabel(doctor: {
  slotDuration?: string | number | null
  schedule?: DoctorScheduleDate[] | null
}): string | null {
  if (!hasAnySchedule(doctor.schedule)) return null
  return formatDurationRu(getSlotDurationMinutes(doctor.slotDuration))
}
