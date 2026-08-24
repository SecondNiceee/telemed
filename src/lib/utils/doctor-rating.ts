/**
 * Агрегат по отзывам одного врача. Считается на сервере (см.
 * `@/lib/server/doctor-ratings`) и передаётся в клиентские компоненты —
 * поэтому типы живут отдельно от серверного модуля.
 */
export interface DoctorRating {
  /** Средний балл 1–5. Врачи без отзывов в карту не попадают вообще. */
  average: number
  /** Сколько отзывов участвовало в среднем. */
  count: number
}

/** doctorId -> агрегат. Врача без отзывов в карте нет. */
export type DoctorRatingsMap = Record<number, DoctorRating>

export const SORT_OPTIONS = [
  { id: 'rating', label: 'По рейтингу' },
  { id: 'price-asc', label: 'Цена: сначала дешевле' },
  { id: 'price-desc', label: 'Цена: сначала дороже' },
] as const

export type DoctorSortOption = (typeof SORT_OPTIONS)[number]['id']

/** Дефолт по требованию: сортировка по рейтингу выбрана изначально. */
export const DEFAULT_SORT: DoctorSortOption = 'rating'

/** Ключ, под которым выбор сортировки переживает перезагрузку страницы. */
export const SORT_STORAGE_KEY = 'category-doctors-sort'

export function isDoctorSortOption(value: unknown): value is DoctorSortOption {
  return SORT_OPTIONS.some((option) => option.id === value)
}
