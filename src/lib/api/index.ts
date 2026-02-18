// Main API exports
export { ApiError, getErrorCode, getErrorMessage } from './errors'
export { apiFetch, getBaseUrl } from './fetch'
export { AuthApi } from './auth'
export { CategoriesApi } from './categories'
export { DoctorsApi } from './doctors'
export type {
  ApiCategory,
  ApiMedia,
  ApiEducationItem,
  ApiServiceItem,
  ApiDoctor,
  PayloadListResponse,
} from './types'

// Legacy support: export functions as top-level exports for backward compatibility
import { CategoriesApi } from './categories'
import { DoctorsApi } from './doctors'

export const fetchCategories = () => CategoriesApi.fetchAll()
export const fetchCategoryBySlug = (slug: string) => CategoriesApi.fetchBySlug(slug)
export const fetchCategoryById = (id: number) => CategoriesApi.fetchById(id)

export const fetchDoctors = () => DoctorsApi.fetchAll()
export const fetchDoctorsByCategory = (categoryId: number) => DoctorsApi.fetchByCategory(categoryId)
export const fetchDoctorById = (id: number | string) => DoctorsApi.fetchById(id)

export const getDoctorCategories = (doctor: any) => DoctorsApi.getCategories(doctor)
export const getDoctorSpecialty = (doctor: any) => DoctorsApi.getSpecialty(doctor)
export const getDoctorEducation = (doctor: any) => DoctorsApi.getEducation(doctor)
export const getDoctorServices = (doctor: any) => DoctorsApi.getServices(doctor)
