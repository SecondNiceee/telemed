import { apiFetch } from './fetch'
import type { ApiAppointment, PayloadListResponse } from './types'

export class AppointmentsApi {
  /**
   * Book an appointment (creates appointment + removes slot from doctor schedule)
   */
  static async book(
    doctorId: number,
    date: string,
    time: string,
  ): Promise<{ message: string; appointment: ApiAppointment }> {
    return apiFetch('/api/appointments/book', {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ doctorId, date, time }),
    })
  }

  /**
   * Fetch appointments for the currently logged-in user
   */
  static async fetchMyAppointments(): Promise<ApiAppointment[]> {
    const data = await apiFetch<PayloadListResponse<ApiAppointment>>(
      '/api/appointments?depth=1&sort=-createdAt&limit=100',
      { credentials: 'include' },
    )
    return data.docs
  }

  /**
   * Fetch appointments for a specific doctor (called from doctor LK)
   */
  static async fetchDoctorAppointments(): Promise<ApiAppointment[]> {
    const data = await apiFetch<PayloadListResponse<ApiAppointment>>(
      '/api/appointments?depth=1&sort=-createdAt&limit=100',
      { credentials: 'include' },
    )
    return data.docs
  }
}
