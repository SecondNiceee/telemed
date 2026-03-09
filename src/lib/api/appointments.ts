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
   * Fetch appointments for the current user (server-side with cookie)
   */
  static async fetchMyAppointmentsServer(options: ServerOptions = {}): Promise<ApiAppointment[]> {
    const data = await serverApiFetch<PayloadListResponse<ApiAppointment>>(
      '/api/appointments?limit=100&depth=1&sort=-date',
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
}
