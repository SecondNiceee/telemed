import { apiFetch, serverApiFetch } from './fetch'
import type { ApiAppointment, PayloadListResponse } from './types'

interface ServerOptions {
  cookie?: string
}

export interface CreateAppointmentPayload {
  doctor: number
  user: number
  doctorName: string
  userName: string
  specialty: string
  date: string
  time: string
  price: number
  connectionType?: 'chat' | 'audio' | 'video'
}

export class AppointmentsApi {
  /**
   * Create a new appointment (requires payload-token cookie)
   */
  static async create(data: CreateAppointmentPayload): Promise<ApiAppointment> {
    return apiFetch<ApiAppointment>('/api/appointments', {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify(data),
    })
  }

  /**
   * Complete an appointment (doctor only - requires doctors-token cookie)
   */
  static async complete(appointmentId: number): Promise<ApiAppointment> {
    return apiFetch<ApiAppointment>(`/api/appointments/${appointmentId}/complete`, {
      method: 'POST',
      credentials: 'include',
    })
  }

  /**
   * Fetch appointments for the current user (client-side)
   */
  static async fetchMyAppointments(): Promise<ApiAppointment[]> {
    const data = await apiFetch<PayloadListResponse<ApiAppointment>>(
      '/api/appointments?limit=100&depth=1&sort=-date',
      { credentials: 'include' },
    )
    return data.docs
  }

  /**
   * Fetch appointments for a specific user by ID (server-side with cookie)
   * This explicitly filters by user ID to avoid showing appointments from other roles
   */
  static async fetchMyAppointmentsServer(options: ServerOptions & { userId: number }): Promise<ApiAppointment[]> {
    const data = await serverApiFetch<PayloadListResponse<ApiAppointment>>(
      `/api/appointments?where[user][equals]=${options.userId}&limit=100&depth=1&sort=-date`,
      options,
    )
    return data.docs
  }

  /**
   * Fetch appointments for a specific doctor (public -- used to check busy slots)
   * We pass the doctor ID as a filter.
   */
  static async fetchByDoctor(doctorId: number): Promise<ApiAppointment[]> {
    const data = await apiFetch<PayloadListResponse<ApiAppointment>>(
      `/api/appointments?where[doctor][equals]=${doctorId}&where[status][not_equals]=cancelled&limit=500&depth=0`,
      { credentials: 'include' },
    )
    return data.docs
  }

  /**
   * Fetch appointments for the current doctor (client-side)
   * Uses doctors-token cookie for auth
   */
  static async fetchDoctorAppointments(): Promise<ApiAppointment[]> {
    const data = await apiFetch<PayloadListResponse<ApiAppointment>>(
      '/api/appointments?limit=100&depth=1&sort=-date',
      { credentials: 'include' },
    )
    return data.docs
  }

  /**
   * Fetch appointments for a specific doctor by ID (server-side with cookie)
   * This explicitly filters by doctor ID to avoid showing appointments from other roles
   */
  static async fetchDoctorAppointmentsServer(options: ServerOptions & { doctorId: number }): Promise<ApiAppointment[]> {
    const data = await serverApiFetch<PayloadListResponse<ApiAppointment>>(
      `/api/appointments?where[doctor][equals]=${options.doctorId}&limit=100&depth=1&sort=-date`,
      { ...options, cache: 'no-store' },
    )
    return data.docs
  }

  /**
   * Fetch appointments for a specific doctor (used by org dashboard)
   * Organisation uses organisations-token cookie
   */
  static async fetchByDoctorServer(doctorId: number, options: ServerOptions = {}): Promise<ApiAppointment[]> {
    const data = await serverApiFetch<PayloadListResponse<ApiAppointment>>(
      `/api/appointments?where[doctor][equals]=${doctorId}&limit=500&depth=1&sort=-date`,
      { ...options, cache: 'no-store' },
    )
    return data.docs
  }

  /**
   * Fetch appointments for multiple doctors (used by org stats)
   */
  static async fetchByDoctorsServer(doctorIds: number[], options: ServerOptions = {}): Promise<ApiAppointment[]> {
    if (doctorIds.length === 0) return []
    const query = doctorIds.map(id => `where[doctor][in]=${id}`).join('&')
    const data = await serverApiFetch<PayloadListResponse<ApiAppointment>>(
      `/api/appointments?${query}&limit=500&depth=1&sort=-date`,
      { ...options, cache: 'no-store' },
    )
    return data.docs
  }

  /**
   * Fetch a single appointment by ID
   */
  static async fetchByIdServer(appointmentId: number, options: ServerOptions = {}): Promise<ApiAppointment> {
    return serverApiFetch<ApiAppointment>(
      `/api/appointments/${appointmentId}?depth=1`,
      { ...options, cache: 'no-store' },
    )
  }

  /**
   * Fetch appointments for multiple doctors with pagination and filtering (client-side)
   * Used by org consultations page
   */
  static async fetchByDoctorsPaginated(
    doctorIds: number[],
    options: {
      page?: number
      limit?: number
      search?: string
      sort?: 'all' | 'now' | 'future' | 'past'
    } = {}
  ): Promise<PayloadListResponse<ApiAppointment>> {
    if (doctorIds.length === 0) {
      return { docs: [], totalDocs: 0, limit: 10, totalPages: 0, page: 1, pagingCounter: 1, hasPrevPage: false, hasNextPage: false, prevPage: null, nextPage: null }
    }
    
    const { page = 1, limit = 10, search, sort = 'all' } = options
    const params = new URLSearchParams()
    
    // Filter by doctor IDs
    doctorIds.forEach(id => params.append('where[doctor][in]', String(id)))
    
    // Sort filter by status
    if (sort === 'now') {
      // Only in_progress consultations
      params.append('where[status][equals]', 'in_progress')
    } else if (sort === 'past') {
      // Only completed consultations
      params.append('where[status][equals]', 'completed')
    } else if (sort === 'future') {
      // Only confirmed (upcoming) consultations - exclude completed and in_progress
      params.append('where[status][equals]', 'confirmed')
    } else {
      // 'all' - exclude only cancelled
      params.append('where[status][not_equals]', 'cancelled')
    }
    
    // Search by doctor name or user name
    if (search) {
      params.append('where[or][0][doctorName][contains]', search)
      params.append('where[or][1][userName][contains]', search)
    }
    
    params.append('limit', String(limit))
    params.append('page', String(page))
    params.append('depth', '1')
    params.append('sort', '-date')
    
    return apiFetch<PayloadListResponse<ApiAppointment>>(
      `/api/appointments?${params.toString()}`,
      { credentials: 'include' },
    )
  }
}
