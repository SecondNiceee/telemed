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
}
