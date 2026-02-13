import { apiFetch } from './fetch'
import { ApiCategory, PayloadListResponse } from './types'

export class CategoriesApi {
  /**
   * Fetch all doctor categories
   */
  static async fetchAll(): Promise<ApiCategory[]> {
    const data = await apiFetch<PayloadListResponse<ApiCategory>>(
      '/api/doctor-categories?limit=100&sort=name',
    )
    return data.docs
  }

  /**
   * Fetch category by slug
   */
  static async fetchBySlug(slug: string): Promise<ApiCategory | null> {
    const data = await apiFetch<PayloadListResponse<ApiCategory>>(
      `/api/doctor-categories?where[slug][equals]=${encodeURIComponent(slug)}&limit=1`,
    )
    return data.docs[0] ?? null
  }

  /**
   * Fetch category by ID
   */
  static async fetchById(id: number): Promise<ApiCategory> {
    return apiFetch<ApiCategory>(`/api/doctor-categories/${id}`)
  }
}
