import type { ApiDoctor } from '@/lib/api/types'

/**
 * Рейтинг врача — это уже готовые поля `rating` и `reviewsCount` на самом
 * враче: их пишут хуки коллекции отзывов (см. collections/helpers/doctor-rating).
 * Поэтому здесь нет ни запросов, ни агрегации — только чтение и нормализация.
 */
export interface DoctorRating {
  /** Средний балл 1–5. */
  average: number
  /** Сколько отзывов участвовало в среднем. */
  count: number
}

/**
 * Достаёт рейтинг из врача. null — отзывов нет (или значение битое).
 *
 * Проверяем count, а не только rating: врач без отзывов приходит с NULL, а из
 * postgres `numeric` попадает строкой при некоторых путях сериализации —
 * поэтому оба поля приводим к числу и отбрасываем нечисловое.
 */
export function getDoctorRating(doctor: Pick<ApiDoctor, 'rating' | 'reviewsCount'>): DoctorRating | null {
  const average = Number(doctor.rating)
  const count = Number(doctor.reviewsCount)

  if (!Number.isFinite(average) || !Number.isFinite(count) || count <= 0) return null

  return { average, count }
}

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
