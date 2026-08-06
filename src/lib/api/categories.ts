import { apiFetch } from './fetch'
import { ApiCategory, ApiMedia, PayloadListResponse } from './types'

/** Cache tag used for all category queries. Revalidated via DoctorCategories hooks. */
export const CATEGORIES_CACHE_TAG = 'categories'

export interface CreateCategoryPayload {
  name: string
  slug: string
  description?: string
  icon?: string
  iconImage?: number
}

export class CategoriesApi {
  /**
   * Fetch all doctor categories
   */
  static async fetchAll(): Promise<ApiCategory[]> {
    const data = await apiFetch<PayloadListResponse<ApiCategory>>(
      '/api/doctor-categories?limit=100&sort=name',
      { next: { tags: [CATEGORIES_CACHE_TAG] }},
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
   * Upload a media file (for category icon image).
   * Uses multipart/form-data — no Content-Type override.
   */
  static async uploadMedia(file: File): Promise<ApiMedia> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('alt', file.name)

    const baseUrl = typeof window !== 'undefined' ? '' : (process.env.SERVER_URL || 'http://localhost:3000')
    const response = await fetch(`${baseUrl}/api/media`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body?.message || `Upload failed: ${response.status}`)
    }
    const data = await response.json()
    return data.doc as ApiMedia
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

  /**
   * Update a category by ID (from organisation)
   */
  static async update(id: number, data: Partial<CreateCategoryPayload>): Promise<ApiCategory> {
    return apiFetch<ApiCategory>(`/api/organisations/categories/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      body: JSON.stringify(data),
    })
  }

  /**
   * Delete a category by ID (from organisation)
   */
  static async delete(id: number): Promise<void> {
    await apiFetch<{ success: boolean }>(`/api/organisations/categories/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
  }

  /**
   * Fetch category by ID for organisation (includes auth check)
   */
  static async fetchByIdForOrg(id: number): Promise<ApiCategory> {
    return apiFetch<ApiCategory>(`/api/organisations/categories/${id}`, {
      credentials: 'include',
    })
  }
}
