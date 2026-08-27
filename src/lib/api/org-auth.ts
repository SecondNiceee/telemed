import { apiFetch } from './fetch'

export interface ApiOrganisation {
  id: number
  name: string
  email: string
  supportPhone?: string | null
  /**
   * Юридические реквизиты организации.
   *
   * Клиника заполняет их сама: она оператор данных о здоровье своих пациентов,
   * и подставлять эти сведения за неё нельзя - ошибка попадёт в согласие
   * пациента и в публичный реестр как её собственное заявление.
   */
  legalName?: string | null
  inn?: string | null
  ogrn?: string | null
  legalAddress?: string | null
  privacyEmail?: string | null
  licenceNumber?: string | null
  licenceIssuedBy?: string | null
  licenceIssuedAt?: string | null
  createdAt: string
  updatedAt: string
}

/** Поля реквизитов, которые организация правит в своём кабинете. */
export type OrganisationRequisites = Pick<
  ApiOrganisation,
  | 'legalName'
  | 'inn'
  | 'ogrn'
  | 'legalAddress'
  | 'privacyEmail'
  | 'licenceNumber'
  | 'licenceIssuedBy'
  | 'licenceIssuedAt'
>

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
    data: Partial<Pick<ApiOrganisation, 'name' | 'supportPhone'> & OrganisationRequisites>,
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
