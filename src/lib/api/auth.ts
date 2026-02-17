import type { User } from '@/payload-types'

interface LoginResponse {
  token: string
  user: User
  exp: number
  message: string
}

interface MeResponse {
  user: User | null
}

export const AuthApi = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const res = await fetch('/api/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => null)
      const message =
        body?.errors?.[0]?.message ||
        body?.message ||
        'Неверный email или пароль'
      throw new Error(message)
    }

    return res.json()
  },

  async me(): Promise<User | null> {
    const res = await fetch('/api/users/me', {
      method: 'GET',
      credentials: 'include',
    })

    if (!res.ok) return null

    const data: MeResponse = await res.json()
    return data.user ?? null
  },

  async logout(): Promise<void> {
    await fetch('/api/users/logout', {
      method: 'POST',
      credentials: 'include',
    })
  },
}
