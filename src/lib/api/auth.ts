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
  /** Телефон в любом виде — будет нормализован до +7XXXXXXXXXX */
  phone: string
  password: string
  email?: string
}

interface CodeResponse {
  message: string
  resendAfter?: number
}

interface ServerOptions {
  cookie?: string
}



export class AuthApi {
  /**
   * Login with phone number and password.
   * Телефон хранится в поле `username` коллекции users.
   */
  static async login(phone: string, password: string): Promise<LoginResponse> {
    return apiFetch<LoginResponse>('/api/users/login', {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ username: normalizePhone(phone) ?? phone, password }),
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
   * Register a new user. Отправляет SMS с кодом подтверждения.
   */
  static async register(data: RegisterData): Promise<CodeResponse> {
    return apiFetch<CodeResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ ...data, phone: normalizePhone(data.phone) ?? data.phone }),
    })
  }

  /**
   * Подтверждение телефона кодом из SMS.
   */
  static async verifyPhone(phone: string, code: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>('/api/auth/verify-phone', {
      method: 'POST',
      body: JSON.stringify({ phone: normalizePhone(phone) ?? phone, code }),
    })
  }

  /**
   * Повторная отправка кода подтверждения.
   */
  static async resendCode(phone: string): Promise<CodeResponse> {
    return apiFetch<CodeResponse>('/api/auth/resend-code', {
      method: 'POST',
      body: JSON.stringify({ phone: normalizePhone(phone) ?? phone }),
    })
  }
}
