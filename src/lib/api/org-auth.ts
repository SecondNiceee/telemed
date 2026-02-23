import { apiFetch } from './fetch'

export interface ApiOrganisation {
  id: number
  name: string
  email: string
  createdAt: string
  updatedAt: string
}

interface OrgLoginResponse {
  token: string
  user: ApiOrganisation
  exp: number
  message: string
}

interface OrgMeResponse {
  user: ApiOrganisation | null
}

export class OrgAuthApi {
  static async login(email: string, password: string): Promise<OrgLoginResponse> {
    return apiFetch<OrgLoginResponse>('/api/organisations/login', {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    })
  }

  static async me(): Promise<ApiOrganisation | null> {
    try {
      const data = await apiFetch<OrgMeResponse>('/api/organisations/me', {
        credentials: 'include',
      })
      return data.user ?? null
    } catch {
      return null
    }
  }

  static async logout(): Promise<void> {
    await apiFetch<{ message: string }>('/api/organisations/logout', {
      method: 'POST',
      credentials: 'include',
    })
  }
}
