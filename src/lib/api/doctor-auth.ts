import { apiFetch } from './fetch'
import type { ApiDoctor } from './types'

interface DoctorLoginResponse {
  token: string
  user: ApiDoctor
  exp: number
  message: string
}

interface DoctorMeResponse {
  user: ApiDoctor | null
}

export class DoctorAuthApi {
  static async login(email: string, password: string): Promise<DoctorLoginResponse> {
    return apiFetch<DoctorLoginResponse>('/api/doctors/login', {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    })
  }

  static async me(): Promise<ApiDoctor | null> {
    try {
      const data = await apiFetch<DoctorMeResponse>('/api/doctors/me', {
        credentials: 'include',
      })
      return data.user ?? null
    } catch {
      return null
    }
  }

  static async logout(): Promise<void> {
    await apiFetch<{ message: string }>('/api/doctors/logout', {
      method: 'POST',
      credentials: 'include',
    })
  }
}
