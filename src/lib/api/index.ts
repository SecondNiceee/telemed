// Main API exports
export { ApiError, getErrorMessage } from './errors'
export { apiFetch, serverApiFetch, getBaseUrl } from './fetch'
export type { ApiFetchOptions } from './fetch'
export { AuthApi } from './auth'
export { OrgAuthApi } from './org-auth'
export { DoctorAuthApi } from './doctor-auth'
export { CategoriesApi } from './categories'
export { DoctorsApi } from './doctors'
export { AppointmentsApi } from './appointments'
export { MessagesApi } from './messages'
export { SiteSettingsApi } from './site-settings'
export type { SiteSettings, FaqItem } from './site-settings'
export type {
  ApiCategory,
  ApiMedia,
  ApiEducationItem,
  ApiServiceItem,
  ApiDoctor,
  ApiAppointment,
  ApiOrganisation,
  PayloadListResponse,
} from './types'
export type { CreateCategoryPayload } from './categories'
export type { ApiMessage } from './messages'

// Legacy support: export functions as top-level exports for backward compatibility
import { AuthApi } from './auth'
import { CategoriesApi } from './categories'
import { DoctorsApi } from './doctors'
import type { ApiDoctor } from './types'

export const login = (email: string, password: string) => AuthApi.login(email, password)
export const me = () => AuthApi.me()
export const logout = () => AuthApi.logout()

export const fetchCategories = () => CategoriesApi.fetchAll()
export const fetchCategoryBySlug = (slug: string) => CategoriesApi.fetchBySlug(slug)
export const fetchCategoryById = (id: number) => CategoriesApi.fetchById(id)

export const fetchDoctors = () => DoctorsApi.fetchAll()
export const fetchDoctorsByCategory = (categoryId: number) => DoctorsApi.fetchByCategory(categoryId)
export const fetchDoctorById = (id: number | string) => DoctorsApi.fetchById(id)

export const getDoctorCategories = (doctor: ApiDoctor) => DoctorsApi.getCategories(doctor)
export const getDoctorSpecialty = (doctor: ApiDoctor) => DoctorsApi.getSpecialty(doctor)
export const getDoctorEducation = (doctor: ApiDoctor) => DoctorsApi.getEducation(doctor)
export const getDoctorServices = (doctor: ApiDoctor) => DoctorsApi.getServices(doctor)
