// ============================================================
// Payload REST API client with typed error handling
// ============================================================

// --------------- Types ---------------

export interface ApiCategory {
  id: number
  name: string
  slug: string
  description?: string | null
  icon?: string | null
  createdAt: string
  updatedAt: string
}

export interface ApiMedia {
  id: number
  alt: string
  url?: string | null
  thumbnailURL?: string | null
  filename?: string | null
  mimeType?: string | null
  width?: number | null
  height?: number | null
}

export interface ApiEducationItem {
  value?: string | null
  id?: string
}

export interface ApiServiceItem {
  value?: string | null
  id?: string
}

export interface ApiDoctor {
  id: number
  email: string
  role: 'doctor'
  name?: string | null
  categories?: (ApiCategory | number)[] | null
  experience?: number | null
  degree?: string | null
  price?: number | null
  photo?: ApiMedia | number | null
  bio?: string | null
  education?: ApiEducationItem[] | null
  services?: ApiServiceItem[] | null
  createdAt: string
  updatedAt: string
}

export interface PayloadListResponse<T> {
  docs: T[]
  totalDocs: number
  limit: number
  totalPages: number
  page: number
  pagingCounter: number
  hasPrevPage: boolean
  hasNextPage: boolean
  prevPage: number | null
  nextPage: number | null
}

// --------------- Error class ---------------

export class ApiError extends Error {
  status: number
  code: string

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code ?? getErrorCode(status)
  }
}

function getErrorCode(status: number): string {
  switch (status) {
    case 400:
      return 'BAD_REQUEST'
    case 401:
      return 'UNAUTHORIZED'
    case 403:
      return 'FORBIDDEN'
    case 404:
      return 'NOT_FOUND'
    case 429:
      return 'TOO_MANY_REQUESTS'
    case 500:
      return 'INTERNAL_SERVER_ERROR'
    default:
      return 'UNKNOWN_ERROR'
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'UNAUTHORIZED':
        return 'Вы не авторизованы. Пожалуйста, войдите в систему.'
      case 'FORBIDDEN':
        return 'У вас нет доступа к этому ресурсу.'
      case 'NOT_FOUND':
        return 'Запрашиваемый ресурс не найден.'
      case 'TOO_MANY_REQUESTS':
        return 'Слишком много запросов. Попробуйте позже.'
      case 'INTERNAL_SERVER_ERROR':
        return 'Произошла ошибка на сервере. Попробуйте позже.'
      default:
        return error.message || 'Произошла неизвестная ошибка.'
    }
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Произошла неизвестная ошибка.'
}

// --------------- Base fetch helper ---------------

function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return '' // client-side: relative URLs
  }
  return process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = getBaseUrl()
  const url = `${baseUrl}${path}`

  let response: Response

  try {
    response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    })
  } catch (err) {
    throw new ApiError(
      0,
      err instanceof Error ? err.message : 'Ошибка сети. Проверьте подключение к интернету.',
      'NETWORK_ERROR',
    )
  }

  if (!response.ok) {
    let errorMessage = `Ошибка ${response.status}`
    try {
      const body = await response.json()
      if (body?.errors?.[0]?.message) {
        errorMessage = body.errors[0].message
      } else if (body?.message) {
        errorMessage = body.message
      }
    } catch {
      // ignore JSON parse errors, use default message
    }

    throw new ApiError(response.status, errorMessage)
  }

  return response.json() as Promise<T>
}

// --------------- Categories ---------------

export async function fetchCategories(): Promise<ApiCategory[]> {
  const data = await apiFetch<PayloadListResponse<ApiCategory>>(
    '/api/doctor-categories?limit=100&sort=name',
  )
  return data.docs
}

export async function fetchCategoryBySlug(slug: string): Promise<ApiCategory | null> {
  const data = await apiFetch<PayloadListResponse<ApiCategory>>(
    `/api/doctor-categories?where[slug][equals]=${encodeURIComponent(slug)}&limit=1`,
  )
  return data.docs[0] ?? null
}

export async function fetchCategoryById(id: number): Promise<ApiCategory> {
  return apiFetch<ApiCategory>(`/api/doctor-categories/${id}`)
}

// --------------- Doctors ---------------

export async function fetchDoctors(): Promise<ApiDoctor[]> {
  const data = await apiFetch<PayloadListResponse<ApiDoctor>>(
    '/api/users?where[role][equals]=doctor&limit=100&depth=1&sort=name',
  )
  return data.docs
}

export async function fetchDoctorsByCategory(categoryId: number): Promise<ApiDoctor[]> {
  const data = await apiFetch<PayloadListResponse<ApiDoctor>>(
    `/api/users?where[role][equals]=doctor&where[categories][in]=${categoryId}&limit=100&depth=1&sort=name`,
  )
  return data.docs
}

export async function fetchDoctorById(id: number | string): Promise<ApiDoctor> {
  return apiFetch<ApiDoctor>(`/api/users/${id}?depth=1`)
}

// --------------- Helpers for components ---------------

/** Get the photo URL from a doctor's photo field (which may be a Media object or just an ID) */
export function getDoctorPhotoUrl(doctor: ApiDoctor): string | null {
  if (!doctor.photo) return null
  if (typeof doctor.photo === 'number') return null
  return doctor.photo.url ?? null
}

/** Get resolved category objects from a doctor's categories field */
export function getDoctorCategories(doctor: ApiDoctor): ApiCategory[] {
  if (!doctor.categories) return []
  return doctor.categories.filter(
    (cat): cat is ApiCategory => typeof cat !== 'number',
  )
}

/** Get the primary specialty label for display */
export function getDoctorSpecialty(doctor: ApiDoctor): string {
  const cats = getDoctorCategories(doctor)
  if (cats.length === 0) return 'Врач'
  return cats.map((c) => c.name).join(', ')
}

/** Get education as string array */
export function getDoctorEducation(doctor: ApiDoctor): string[] {
  if (!doctor.education) return []
  return doctor.education.map((e) => e.value).filter((v): v is string => Boolean(v))
}

/** Get services as string array */
export function getDoctorServices(doctor: ApiDoctor): string[] {
  if (!doctor.services) return []
  return doctor.services.map((s) => s.value).filter((v): v is string => Boolean(v))
}
