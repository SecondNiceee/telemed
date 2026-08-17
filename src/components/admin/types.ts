import type { ApiCategory } from '@/lib/api/types'

export type AdminCategory = ApiCategory

export interface AdminOrganisation {
  id: number | string
  name: string
  email: string
  createdAt?: string | null
}

export interface AdminUser {
  id: number | string
  name?: string | null
  email: string
}

/** Пара логин/пароль, которую показываем один раз после создания или сброса. */
export interface IssuedCredentials {
  organisationName: string
  email: string
  password: string
}
