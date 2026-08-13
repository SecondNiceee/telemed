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
    const url = `${baseUrl}/api/media`

    console.log('[v0] uploadMedia ->', url, {
      name: file.name,
      type: file.type,
      size: file.size,
    })

    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
    } catch (err) {
      // The request never completed: nginx cut it, the body was too large,
      // or the dev server restarted mid-upload.
      console.error('[v0] uploadMedia network error', { url, err })
      throw new Error(
        `Сетевая ошибка при загрузке файла (${file.name}, ${(file.size / 1024).toFixed(0)} КБ): ${
          err instanceof Error ? err.message : String(err)
        }`,
      )
    }

    // The error body is not always JSON — nginx returns HTML for 413/502.
    const rawText = await response.text()
    let body: Record<string, unknown> = {}
    try {
      body = rawText ? JSON.parse(rawText) : {}
    } catch {
      body = {}
    }

    if (!response.ok) {
      console.error('[v0] uploadMedia failed', {
        url,
        status: response.status,
        contentType: response.headers.get('content-type'),
        body: body && Object.keys(body).length ? body : rawText.slice(0, 500),
      })

      const nested = body as {
        errors?: { message?: string }[]
        message?: string
        error?: string
      }
      const message =
        nested.errors?.[0]?.message ||
        nested.message ||
        nested.error ||
        (rawText ? rawText.slice(0, 300) : `Upload failed: ${response.status}`)

      throw new Error(`Загрузка файла не удалась (${response.status}): ${message}`)
    }

    const doc = (body as { doc?: ApiMedia }).doc
    if (!doc?.id) {
      console.error('[v0] uploadMedia returned no doc', { body })
      throw new Error('Сервер не вернул загруженный файл (нет doc.id)')
    }

    console.log('[v0] uploadMedia success', { id: doc.id, filename: doc.filename })
    return doc
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
