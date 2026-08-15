import { apiFetch, serverApiFetch } from './fetch'
import type { ApiAppointment, PayloadListResponse } from './types'

interface ServerOptions {
  cookie?: string
}

/**
 * Тело создания записи.
 *
 * ВАЖНО: `user`, `price`, `status`, `paymentExpiresAt` и `paidAt` сервер
 * выставляет сам (см. `applyBookingGuards` в collections/helpers), поэтому
 * с клиента их присылать бессмысленно — значения будут перезаписаны.
 * Клиент выбирает только врача, дату, время и способ связи.
 */
export interface CreateAppointmentPayload {
  doctor: number
  user: number
  doctorName: string
  userName: string
  specialty: string
  date: string
  time: string
  connectionType?: 'chat' | 'audio' | 'video'
}

export class AppointmentsApi {
  /**
   * Create a new appointment (requires payload-token cookie)
   *
   * NOTE: this hits Payload's native REST create endpoint directly
   * (there is no custom /api/appointments route in this app), which wraps
   * the created document as `{ message, doc }` — unlike our custom routes
   * (pay/release/complete) which return the document directly. Unwrap it
   * here so callers always get the appointment itself.
   */
  static async create(data: CreateAppointmentPayload): Promise<ApiAppointment> {
    const response = await apiFetch<ApiAppointment | { message?: string; doc?: ApiAppointment }>(
      '/api/appointments',
      {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify(data),
      },
    )

    const appointment =
      response && typeof response === 'object' && 'doc' in response && response.doc
        ? response.doc
        : (response as ApiAppointment)

    console.log('[v0] AppointmentsApi.create response', {
      hadDocWrapper: !!(response as { doc?: unknown })?.doc,
      appointmentId: appointment?.id,
    })

    if (!appointment?.id) {
      console.error('[v0] AppointmentsApi.create: appointment id missing from response', {
        response,
      })
    }

    return appointment
  }

  /**
   * Pay for a pending appointment — moves it to "confirmed".
   */
  static async pay(appointmentId: number): Promise<ApiAppointment> {
    return apiFetch<ApiAppointment>(`/api/appointments/${appointmentId}/pay`, {
      method: 'POST',
      credentials: 'include',
    })
  }

  /**
   * Release an unpaid hold (cancel button or expired timer).
   * The doctor's slot goes back into the schedule.
   */
  static async release(appointmentId: number): Promise<{ released: boolean }> {
    return apiFetch<{ released: boolean }>(`/api/appointments/${appointmentId}/release`, {
      method: 'POST',
      credentials: 'include',
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
      // Неоплаченные брони врачу не показываем — это ещё не запись.
      '/api/appointments?where[status][not_equals]=pending_payment&limit=100&depth=1&sort=-date',
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
      `/api/appointments?where[doctor][equals]=${options.doctorId}&where[status][not_equals]=pending_payment&limit=100&depth=1&sort=-date`,
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
      `/api/appointments?where[doctor][equals]=${doctorId}&where[status][not_equals]=pending_payment&limit=500&depth=1&sort=-date`,
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
      `/api/appointments?${query}&where[status][not_equals]=pending_payment&limit=500&depth=1&sort=-date`,
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
      // 'all' - exclude cancelled and unpaid holds (not real bookings yet)
      params.append('where[status][not_in]', 'cancelled,pending_payment')
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
