import 'server-only'
import { unstable_cache } from 'next/cache'
import type { ApiCategory } from './types'

/** Cache tag used for all category queries. Revalidated via DoctorCategories hooks. */
export const CATEGORIES_CACHE_TAG = 'categories'

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
