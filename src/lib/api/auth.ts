import type { User } from '@/payload-types'
import { apiFetch } from './fetch'

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
    return apiFetch<LoginResponse>('/api/users/login', {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    })
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
   * Register a new user (self-registration). Payload will send a verification email.
   */
  static async register(data: RegisterData): Promise<RegisterResponse> {
    return apiFetch<RegisterResponse>('/api/users', {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ ...data, role: 'user' }),
    })
  }

  /**
   * Verify email with the token from the verification email link.
   */
  static async verifyEmail(token: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/api/users/verify-email?token=${token}`, {
      method: 'POST',
    })
  }
}
