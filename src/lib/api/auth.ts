import type { User } from '@/payload-types'
import { apiFetch, serverApiFetch } from './fetch'
import { normalizePhone } from '@/utils/phone'

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
  /** Телефон в любом виде — будет нормализован до +7XXXXXXXXXX */
  phone: string
  password: string
}

interface ServerOptions {
  cookie?: string
}



export class AuthApi {
  /**
   * Login with email and password
   */
  static async login(email: string, password: string): Promise<LoginResponse> {
    return apiFetch<LoginResponse>('/api/users/login', {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    })
  }

  /**
   * Get current authenticated user (client-side)
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
   * Get current authenticated user (server-side with cookie)
   */
  static async meServer(options: ServerOptions = {}): Promise<User | null> {
    try {
      const data = await serverApiFetch<MeResponse>('/api/users/me', options)
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
   * Register a new user. Отправляет письмо для подтверждения email.
   */
  static async register(data: RegisterData): Promise<{ message: string }> {
    return apiFetch<{ message: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ ...data, phone: normalizePhone(data.phone) ?? data.phone }),
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

  /**
   * Запрос письма для восстановления пароля.
   * Payload всегда отвечает 200 — существование email не раскрывается.
   */
  static async forgotPassword(email: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>('/api/users/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  }

  /**
   * Установка нового пароля по токену из письма.
   * Payload сам ставит auth-cookie в ответе, поэтому credentials: 'include'
   * обязателен — иначе автологин не сработает.
   */
  static async resetPassword(
    token: string,
    password: string,
  ): Promise<{ message: string; user: User; token?: string }> {
    return apiFetch<{ message: string; user: User; token?: string }>(
      '/api/users/reset-password',
      {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ token, password }),
      },
    )
  }
}
