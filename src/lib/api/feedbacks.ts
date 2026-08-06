import { apiFetch } from './fetch'
import type { ApiFeedback, PayloadListResponse } from './types'

// Feedbacks API for managing doctor reviews

export interface CreateFeedbackData {
  appointment: number
  doctor: number
  user: number
  rating: number
  text?: string
}

export const FeedbacksApi = {
  /**
   * Create a new feedback
   */
  async create(data: CreateFeedbackData): Promise<ApiFeedback> {
    return apiFetch<ApiFeedback>('/api/feedbacks', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  /**
   * Get feedback by appointment ID
   */
  async getByAppointment(appointmentId: number): Promise<ApiFeedback | null> {
    const response = await apiFetch<PayloadListResponse<ApiFeedback>>(
      `/api/feedbacks?where[appointment][equals]=${appointmentId}&limit=1`
    )
    return response.docs[0] || null
  },

  /**
   * Get all feedbacks for a doctor (with user details)
   */
  async getByDoctor(doctorId: number): Promise<ApiFeedback[]> {
    const response = await apiFetch<PayloadListResponse<ApiFeedback>>(
      `/api/feedbacks?where[doctor][equals]=${doctorId}&sort=-createdAt&depth=2`
    )
    return response.docs
  },

  /**
   * Get all feedbacks by user
   */
  async getByUser(userId: number): Promise<ApiFeedback[]> {
    const response = await apiFetch<PayloadListResponse<ApiFeedback>>(
      `/api/feedbacks?where[user][equals]=${userId}&sort=-createdAt&depth=1`
    )
    return response.docs
  },

  /**
   * Check if user already left feedback for appointment
   */
  async hasFeedback(appointmentId: number): Promise<boolean> {
    const feedback = await this.getByAppointment(appointmentId)
    return feedback !== null
  },
}
