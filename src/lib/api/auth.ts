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
  /**
   * Отметка о согласии на обработку персональных данных.
   * Сервер отклоняет регистрацию без неё - см. /api/auth/register.
   */
  pdnConsentAccepted: boolean
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
   *
   * Идём через свой роут /api/auth/verify-email: он не только подтверждает email,
   * но и сразу выдаёт cookie `payload-token`, поэтому пользователь возвращается
   * на сайт уже авторизованным. credentials: 'include' обязателен — иначе
   * cookie из ответа не сохранится.
   */
  static async verifyEmail(token: string): Promise<{ message: string; user: User | null }> {
    return apiFetch<{ message: string; user: User | null }>('/api/auth/verify-email', {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ token }),
    })
  }

  /**
   * Запрос письма для восстановления пароля.
   *
   * Идём через свой роут, а не нативный /api/users/forgot-password: тот всегда
   * отвечает 200, поэтому для незарегистрированной почты пользователь бесконечно
   * ждал письмо. Наш роут в этом случае возвращает 404 с понятным сообщением.
   */
  static async forgotPassword(email: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>('/api/auth/forgot-password', {
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
