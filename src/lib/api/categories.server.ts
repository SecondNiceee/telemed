import 'server-only'
import { unstable_cache } from 'next/cache'
import type { ApiCategory } from './types'

/** Cache tag used for all category queries. Revalidated via DoctorCategories hooks. */
export const CATEGORIES_CACHE_TAG = 'categories'
const DOCTORS_CACHE_TAG = 'doctors'

/**
 * Сортировка по русскому алфавиту.
 *
 * Payload/БД сортирует по байтам (или по локали БД), из-за чего «Ёндокринолог»,
 * буква «ё» и латиница уезжают в конец списка. Intl.Collator с локалью 'ru'
 * даёт корректный порядок: а, б, в … е, ё, ж …, а numeric заодно правильно
 * сравнивает названия с цифрами.
 */
const ruCollator = new Intl.Collator('ru', { sensitivity: 'base', numeric: true })

function sortCategoriesRu(categories: ApiCategory[]): ApiCategory[] {
  return [...categories].sort((a, b) => ruCollator.compare(a.name ?? '', b.name ?? ''))
}

/**
 * Internal function to fetch categories via Payload Local API.
 */
async function fetchCategoriesInternal(): Promise<ApiCategory[]> {
  const { getPayload } = await import('payload')
  const configPromise = await import('@/payload.config')
  const payload = await getPayload({ config: configPromise.default })
  
  const data = await payload.find({
    collection: 'doctor-categories',
    limit: 100,
    sort: 'name',
  })
  
  return sortCategoriesRu(data.docs as unknown as ApiCategory[])
}

/**
 * Server-side only: Fetch all categories using Payload Local API.
 * This works during build time when the HTTP server isn't running yet.
 * Wrapped with unstable_cache to support revalidateTag in production.
 */
export const fetchCategoriesLocal = unstable_cache(
  fetchCategoriesInternal,
  ['categories-local'],
  { tags: [CATEGORIES_CACHE_TAG] }
)

function toCategoryId(value: unknown): number | string | null {
  if (typeof value === 'number' || typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: number | string }).id
    return id ?? null
  }
  return null
}

/**
 * Получает только категории, к которым привязан хотя бы один врач.
 *
 * Сначала читаются исключительно ID связей categories у врачей (depth: 0 и
 * select), затем нужные категории забираются одним запросом. Это не загружает
 * профили, фото и расписания врачей и не создаёт N+1 запросов.
 */
async function fetchCategoriesWithDoctorsInternal(): Promise<ApiCategory[]> {
  const { getPayload } = await import('payload')
  const configPromise = await import('@/payload.config')
  const payload = await getPayload({ config: configPromise.default })

  const categoryIds = new Set<number | string>()
  let page = 1
  let hasNextPage = true

  while (hasNextPage) {
    const doctors = await payload.find({
      collection: 'doctors',
      page,
      limit: 500,
      depth: 0,
      pagination: true,
      select: { categories: true },
    })

    for (const doctor of doctors.docs) {
      const categories = Array.isArray(doctor.categories) ? doctor.categories : []
      for (const category of categories) {
        const id = toCategoryId(category)
        if (id != null) categoryIds.add(id)
      }
    }

    hasNextPage = doctors.hasNextPage
    page += 1
  }

  if (categoryIds.size === 0) return []

  const categories = await payload.find({
    collection: 'doctor-categories',
    where: { id: { in: Array.from(categoryIds) } },
    limit: categoryIds.size,
    depth: 1,
    pagination: false,
  })

  return sortCategoriesRu(categories.docs as unknown as ApiCategory[])
}

/** Categories shown on the home page; invalidated by doctor or category changes. */
export const fetchCategoriesWithDoctorsLocal = unstable_cache(
  fetchCategoriesWithDoctorsInternal,
  ['categories-with-doctors-local'],
  { tags: [CATEGORIES_CACHE_TAG, DOCTORS_CACHE_TAG] },
)
