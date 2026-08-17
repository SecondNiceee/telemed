import { apiFetch } from './fetch'
import { ApiCategory, ApiMedia, PayloadListResponse } from './types'

/** Cache tag used for all category queries. Revalidated via DoctorCategories hooks. */
export const CATEGORIES_CACHE_TAG = 'categories'

export interface CreateCategoryPayload {
  name: string
  slug: string
  description?: string
  icon?: string
  iconImage?: number | null
}

/**
 * Сортировка по русскому алфавиту: сортировка на стороне БД идёт по байтам,
 * из-за чего «ё» и латиница оказываются в конце списка.
 */
const ruCollator = new Intl.Collator('ru', { sensitivity: 'base', numeric: true })

export class CategoriesApi {
  /**
   * Fetch all doctor categories
   */
  static async fetchAll(): Promise<ApiCategory[]> {
    const data = await apiFetch<PayloadListResponse<ApiCategory>>(
      '/api/doctor-categories?limit=100&sort=name',
      { next: { tags: [CATEGORIES_CACHE_TAG] }},
    )
    return [...data.docs].sort((a, b) => ruCollator.compare(a.name ?? '', b.name ?? ''))
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
   * Fallback upload used only when `fetch` throws. Unlike `fetch`, XHR reports
   * the HTTP status when the server did answer, which turns an unactionable
   * "Failed to fetch" into "HTTP 413" / "HTTP 502" / "HTTP 403".
   */
  private static uploadViaXhr(
    url: string,
    file: File,
  ): Promise<{ ok: boolean; status: number; message?: string; doc?: ApiMedia }> {
    return new Promise((resolve) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('alt', file.name)

      const xhr = new XMLHttpRequest()
      xhr.open('POST', url, true)
      xhr.withCredentials = true

      xhr.onload = () => {
        let parsed: Record<string, unknown> = {}
        try {
          parsed = xhr.responseText ? JSON.parse(xhr.responseText) : {}
        } catch {
          parsed = {}
        }

        const nested = parsed as { doc?: ApiMedia; errors?: { message?: string }[]; message?: string; error?: string }

        resolve({
          ok: xhr.status >= 200 && xhr.status < 300,
          status: xhr.status,
          doc: nested.doc,
          message:
            nested.errors?.[0]?.message ||
            nested.message ||
            nested.error ||
            xhr.responseText?.slice(0, 300),
        })
      }

      // status 0 means the connection itself failed — nothing more to report.
      xhr.onerror = () => resolve({ ok: false, status: 0 })
      xhr.ontimeout = () => resolve({ ok: false, status: 0, message: 'timeout' })

      xhr.send(formData)
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
      // `fetch` reports every transport failure as an opaque "Failed to fetch"
      // with no status. XHR does expose the status when the server answered,
      // so retry once through XHR purely to get a diagnosable error.
      console.error('[v0] uploadMedia network error, retrying via XHR', { url, err })

      const xhrResult = await CategoriesApi.uploadViaXhr(url, file)

      if (xhrResult.ok && xhrResult.doc?.id) {
        console.log('[v0] uploadMedia success (xhr)', { id: xhrResult.doc.id })
        return xhrResult.doc
      }

      if (xhrResult.status) {
        throw new Error(
          `Загрузка файла не удалась (HTTP ${xhrResult.status}): ${
            xhrResult.message || 'сервер отклонил запрос'
          }`,
        )
      }

      throw new Error(
        `Сетевая ошибка при загрузке файла (${file.name}, ${(file.size / 1024).toFixed(0)} КБ). ` +
          `Запрос не дошёл до сервера: proxy/nginx оборвал соединение, размер тела превысил ` +
          `client_max_body_size, либо адрес ${url} недоступен. Исходная ошибка: ${
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

  /** Create a category from the authenticated admin panel. */
  static async create(data: CreateCategoryPayload): Promise<ApiCategory> {
    return apiFetch<ApiCategory>('/api/admin/categories', {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify(data),
    })
  }

  /**
   * Update a category by ID (from organisation)
   */
  static async update(id: number, data: Partial<CreateCategoryPayload>): Promise<ApiCategory> {
    return apiFetch<ApiCategory>(`/api/admin/categories/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      body: JSON.stringify(data),
    })
  }

  /**
   * Delete a category by ID (from organisation)
   */
  static async delete(id: number): Promise<void> {
    await apiFetch<{ success: boolean }>(`/api/admin/categories/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
  }

  /**
   * Fetch category by ID for organisation (includes auth check)
   */
  static async fetchByIdForOrg(id: number): Promise<ApiCategory> {
    return apiFetch<ApiCategory>(`/api/admin/categories/${id}`, {
      credentials: 'include',
    })
  }
}
