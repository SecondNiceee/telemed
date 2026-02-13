import { ApiError } from './errors'

export function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return '' // client-side: relative URLs
  }
  return process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  console.log("Тут нет ошибок")
  const baseUrl = getBaseUrl()
  const url = `${baseUrl}${path}`;
  console.log(url);
  
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
