import { apiFetch } from './fetch'

export interface ApiOrganisation {
  id: number
  name: string
  email: string
  supportPhone?: string | null
  createdAt: string
  updatedAt: string
}

interface OrgUpdateResponse {
  doc: ApiOrganisation
  message: string
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
        cache: 'no-store',
      })
      return data.user ?? null
    } catch {
      return null
    }
  }

  static async update(
    id: number | string,
    data: Partial<Pick<ApiOrganisation, 'name' | 'supportPhone'>>,
  ): Promise<ApiOrganisation> {
    const res = await apiFetch<OrgUpdateResponse>(`/api/organisations/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      body: JSON.stringify(data),
    })
    return res.doc
  }

  static async logout(): Promise<void> {
    await apiFetch<{ message: string }>('/api/organisations/logout', {
      method: 'POST',
      credentials: 'include',
    })
  }
}
