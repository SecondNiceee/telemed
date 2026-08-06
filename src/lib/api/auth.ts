import type { User } from '@/payload-types'
import { apiFetch, serverApiFetch } from './fetch'

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
