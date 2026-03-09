import { ApiError } from './errors'
import { getBasePath } from '../utils/basePath'

export function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return getBasePath() // client-side: prepend basePath for relative URLs
  }
  
  // Server-side: use full URL for fetch (basePath is handled by Next.js server)
  return process.env.SERVER_URL || 'http://localhost:3000'
}

export interface ApiFetchOptions extends Omit<RequestInit, 'headers'> {
  headers?: HeadersInit | Record<string, string>
}

export async function apiFetch<T>(path: string, init?: ApiFetchOptions): Promise<T> {
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
    let errorName: string | undefined
    try {
      const body = await response.json()
      if (body?.errors?.[0]?.message) {
        errorMessage = body.errors[0].message
      } else if (body?.message) {
        errorMessage = body.message
      }
      errorName = body?.errors?.[0]?.name ?? body?.name
    } catch {
      // ignore JSON parse errors, use default message
    }

    throw new ApiError(response.status, errorMessage, errorName)
  }

  return response.json() as Promise<T>
}

/**
 * Server-side apiFetch helper that accepts cookie string from headers().
 * Usage in RSC:
 *   const hdrs = await headers()
 *   const cookie = hdrs.get('cookie') ?? ''
 *   const data = await serverApiFetch('/api/users/me', { cookie })
 */
export async function serverApiFetch<T>(
  path: string,
  options: { cookie?: string } & ApiFetchOptions = {},
): Promise<T> {
  const { cookie, ...init } = options
  return apiFetch<T>(path, {
    ...init,
    cache: 'no-store',
    headers: {
      ...init.headers,
      ...(cookie ? { cookie } : {}),
    },
  })
}
