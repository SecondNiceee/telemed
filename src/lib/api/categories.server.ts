import 'server-only'
import type { ApiCategory } from './types'

/** Cache tag used for all category queries. Revalidated via DoctorCategories hooks. */
export const CATEGORIES_CACHE_TAG = 'categories'

/**
 * Server-side only: Fetch all categories using Payload Local API.
 * This works during build time when the HTTP server isn't running yet.
 */
export async function fetchCategoriesLocal(): Promise<ApiCategory[]> {
  const { getPayload } = await import('payload')
  const configPromise = await import('@/payload.config')
  const payload = await getPayload({ config: configPromise.default })
  
  const data = await payload.find({
    collection: 'doctor-categories',
    limit: 100,
    sort: 'name',
  })
  
  return data.docs as unknown as ApiCategory[]
}
