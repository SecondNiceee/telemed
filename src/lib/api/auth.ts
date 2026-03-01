import type { User } from '@/payload-types'
import { apiFetch, getBaseUrl } from './fetch'
import { ApiError } from './errors'

interface LoginResponse {
  token: string
  user: User
  exp: number
  message: string
}

interface MeResponse {
  user: User | null
}

interface RegisterData {
  name: string
  email: string
  password: string
}

interface RegisterResponse {
  doc: User
  message: string
}

export class AuthApi {
  /**
   * Login with email and password
   */
  static async login(email: string, password: string): Promise<LoginResponse> {
    const url = `${getBaseUrl()}/api/users/login`
    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
    } catch (err) {
      throw new ApiError(0, err instanceof Error ? err.message : 'Ошибка сети', 'NETWORK_ERROR')
    }

    if (!response.ok) {
      let name = ''
      try {
        const body = await response.json()
        name = body?.errors?.[0]?.name ?? body?.name ?? ''
      } catch {
        // ignore
      }

      if (response.status === 403 && name === 'UnverifiedEmail') {
        throw new ApiError(
          403,
          'Ваш email ещё не подтверждён. Пройдите регистрацию повторно или подтвердите email по ссылке из письма.',
          'UnverifiedEmail',
        )
      }

      if (response.status === 401) {
        throw new ApiError(401, 'Неверный email или пароль', 'AuthenticationError')
      }

      throw new ApiError(response.status, `Ошибка ${response.status}`)
    }

    return response.json() as Promise<LoginResponse>
  }

  /**
   * Get current authenticated user
   */
  static async me(): Promise<User | null> {
    try {
      const data = await apiFetch<MeResponse>('/api/users/me', {
        credentials: 'include',
        cache: 'no-store',
      })
      return data.user ?? null
    } catch {
      return null
    }
  }

  /**
   * Logout current user
   */
  static async logout(): Promise<void> {
    await apiFetch<{ message: string }>('/api/users/logout', {
      method: 'POST',
      credentials: 'include',
    })
  }

  /**
   * Register a new user via custom route that handles duplicate unverified users.
   */
  static async register(data: RegisterData): Promise<{ message: string }> {
    return apiFetch<{ message: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  /**
   * Verify email with the token from the verification email link.
   * Payload endpoint: POST /api/users/verify/{token}
   */
  static async verifyEmail(token: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/api/users/verify/${token}`, {
      method: 'POST',
    })
  }
}
