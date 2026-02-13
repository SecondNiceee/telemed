import { apiFetch } from './fetch'
import { ApiDoctor, ApiCategory, PayloadListResponse } from './types'

export class DoctorsApi {
  /**
   * Fetch all doctors
   */
  static async fetchAll(): Promise<ApiDoctor[]> {
    const data = await apiFetch<PayloadListResponse<ApiDoctor>>(
      '/api/users?where[role][equals]=doctor&limit=100&depth=1&sort=name',
    )
    return data.docs
  }

  /**
   * Fetch doctors by category ID
   */
  static async fetchByCategory(categoryId: number): Promise<ApiDoctor[]> {
    const data = await apiFetch<PayloadListResponse<ApiDoctor>>(
      `/api/users?where[role][equals]=doctor&where[categories][in]=${categoryId}&limit=100&depth=1&sort=name`,
    )
    return data.docs
  }

  /**
   * Fetch doctor by ID
   */
  static async fetchById(id: number | string): Promise<ApiDoctor> {
    return apiFetch<ApiDoctor>(`/api/users/${id}?depth=1`)
  }

  /**
   * Get the photo URL from a doctor's photo field (which may be a Media object or just an ID)
   */
  static getPhotoUrl(doctor: ApiDoctor): string | null {
    if (!doctor.photo) return null
    if (typeof doctor.photo === 'number') return null
    return doctor.photo.url ?? null
  }

  /**
   * Get resolved category objects from a doctor's categories field
   */
  static getCategories(doctor: ApiDoctor): ApiCategory[] {
    if (!doctor.categories) return []
    return doctor.categories.filter(
      (cat): cat is ApiCategory => typeof cat !== 'number',
    )
  }

  /**
   * Get the primary specialty label for display
   */
  static getSpecialty(doctor: ApiDoctor): string {
    const cats = this.getCategories(doctor)
    if (cats.length === 0) return 'Врач'
    return cats.map((c) => c.name).join(', ')
  }

  /**
   * Get education as string array
   */
  static getEducation(doctor: ApiDoctor): string[] {
    if (!doctor.education) return []
    return doctor.education.map((e) => e.value).filter((v): v is string => Boolean(v))
  }

  /**
   * Get services as string array
   */
  static getServices(doctor: ApiDoctor): string[] {
    if (!doctor.services) return []
    return doctor.services.map((s) => s.value).filter((v): v is string => Boolean(v))
  }
}
