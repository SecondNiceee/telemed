import { apiFetch } from './fetch'
import { getBasePath } from '../basePath'
import { ApiDoctor, ApiCategory, PayloadListResponse } from './types'

/** Cache tag used for all doctor queries. Revalidated via Users hooks when role=doctor. */
export const DOCTORS_CACHE_TAG = 'doctors'

export class DoctorsApi {
  /**
   * Fetch all doctors
   */
  static async fetchAll(): Promise<ApiDoctor[]> {
    const data = await apiFetch<PayloadListResponse<ApiDoctor>>(
      '/api/users?where[role][equals]=doctor&limit=100&depth=1&sort=name',
      { next: { tags: [DOCTORS_CACHE_TAG] } },
    )
    return data.docs
  }

  /**
   * Fetch doctors by category ID
   */
  static async fetchByCategory(categoryId: number): Promise<ApiDoctor[]> {
    const data = await apiFetch<PayloadListResponse<ApiDoctor>>(
      `/api/users?where[role][equals]=doctor&where[categories][in]=${categoryId}&limit=100&depth=1&sort=name`,
      { next: { tags: [DOCTORS_CACHE_TAG] } },
    )
    return data.docs
  }

  /**
   * Fetch doctor by ID
   */
  static async fetchById(id: number | string): Promise<ApiDoctor> {
    return apiFetch<ApiDoctor>(`/api/users/${id}?depth=1`, {
      next: { tags: [DOCTORS_CACHE_TAG] },
    })
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
