import { apiFetch } from './fetch'
import type { PayloadListResponse } from './types'

export interface MessageAttachment {
  id?: string
  name: string
  size: number
  type: string
  url: string
}

export interface ApiMessage {
  id: number
  appointment: number | { id: number }
  senderType: 'user' | 'doctor'
  senderId: number
  text?: string
  attachments?: MessageAttachment[]
  read: boolean
  createdAt: string
  updatedAt: string
}

export class MessagesApi {
  /**
   * Fetch messages for a specific appointment
   */
  static async fetchByAppointment(appointmentId: number): Promise<ApiMessage[]> {
    const data = await apiFetch<PayloadListResponse<ApiMessage>>(
      `/api/messages?where[appointment][equals]=${appointmentId}&sort=createdAt&limit=500&depth=0`,
      { credentials: 'include' }
    )
    return data.docs
  }

  /**
   * Get unread message count for an appointment (messages from the other party)
   */
  static async getUnreadCount(appointmentId: number, senderType: 'user' | 'doctor'): Promise<number> {
    // Get messages NOT from the current sender type that are unread
    const otherSenderType = senderType === 'user' ? 'doctor' : 'user'
    const data = await apiFetch<PayloadListResponse<ApiMessage>>(
      `/api/messages?where[appointment][equals]=${appointmentId}&where[senderType][equals]=${otherSenderType}&where[read][equals]=false&limit=0`,
      { credentials: 'include' }
    )
    return data.totalDocs
  }

  /**
   * Get last message for an appointment
   */
  static async getLastMessage(appointmentId: number): Promise<ApiMessage | null> {
    const data = await apiFetch<PayloadListResponse<ApiMessage>>(
      `/api/messages?where[appointment][equals]=${appointmentId}&sort=-createdAt&limit=1&depth=0`,
      { credentials: 'include' }
    )
    return data.docs[0] || null
  }
}
