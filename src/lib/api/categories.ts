import { apiFetch } from './fetch'
import { ApiCategory, PayloadListResponse } from './types'

/** Cache tag used for all category queries. Revalidated via DoctorCategories hooks. */
export const CATEGORIES_CACHE_TAG = 'categories'

export interface CreateCategoryPayload {
  name: string
  slug: string
  description?: string
  icon?: string
}

export class CategoriesApi {
  /**
   * Fetch all doctor categories
   */
  static async fetchAll(): Promise<ApiCategory[]> {
    const data = await apiFetch<PayloadListResponse<ApiCategory>>(
      '/api/doctor-categories?limit=100&sort=name',
      { next: { tags: [CATEGORIES_CACHE_TAG] } },
    )
    return data.docs
  }

  /**
   * Fetch category by slug
   */
  static async fetchBySlug(slug: string): Promise<ApiCategory | null> {
    const data = await apiFetch<PayloadListResponse<ApiCategory>>(
      `/api/doctor-categories?where[slug][equals]=${encodeURIComponent(slug)}&limit=1`,
      { next: { tags: [CATEGORIES_CACHE_TAG] } },
    )
    return data.docs[0] ?? null
  }

  /**
   * Fetch category by ID
   */
  static async fetchById(id: number): Promise<ApiCategory> {
    return apiFetch<ApiCategory>(`/api/doctor-categories/${id}`, {
      next: { tags: [CATEGORIES_CACHE_TAG] },
    })
  }

  /**
   * Create a new category (from organisation)
   * Uses the special organisations endpoint that handles auth via organisations-token
   */
  static async create(data: CreateCategoryPayload): Promise<ApiCategory> {
    return apiFetch<ApiCategory>('/api/organisations/categories/create', {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify(data),
    })
  }
}
