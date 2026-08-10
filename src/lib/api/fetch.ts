import { ApiError } from './errors'

export function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    // Client-side: root-relative URLs resolve against the current origin
    return ''
  }

  // Server-side: fetch needs an absolute URL
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
    let errorBody: unknown
    try {
      const body = await response.json()
      errorBody = body
      if (body?.errors?.[0]?.message) {
        errorMessage = body.errors[0].message
      } else if (body?.message) {
        errorMessage = body.message
      }
      errorName = body?.errors?.[0]?.name ?? body?.name
    } catch {
      // ignore JSON parse errors, use default message
    }

    throw new ApiError(response.status, errorMessage, errorName, errorBody)
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
