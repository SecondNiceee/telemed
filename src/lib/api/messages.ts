import { apiFetch, serverApiFetch } from './fetch'
import type { PayloadListResponse } from './types'

export interface ApiMessageAttachment {
  id: number
  url: string
  filename: string
  mimeType: string
  filesize: number
  width?: number
  height?: number
}

// Полиморфная связь sender
// При depth=0 возвращается просто ID, при depth>0 - объект с relationTo и value
export interface ApiMessageSender {
  relationTo: 'users' | 'doctors'
  value: number | { id: number }
}

export interface ApiMessage {
  id: number
  clientMessageId?: string | null
  appointment: number | { id: number }
  sender?: ApiMessageSender | null
  text?: string
  attachment?: ApiMessageAttachment | number
  read: boolean
  isSystemMessage?: boolean
  createdAt: string
  updatedAt: string
}

// Хелперы для работы с полиморфной связью
export function getSenderType(message: ApiMessage): 'user' | 'doctor' | null {
  // Защита от старых сообщений без sender или с неполными данными
  // Системные сообщения могут не иметь sender - это нормально
  if (!message.sender || !message.sender.relationTo) {
    return null
  }
  return message.sender.relationTo === 'users' ? 'user' : 'doctor'
}

export function getSenderId(message: ApiMessage): number | null {
  // Защита от старых сообщений без sender
  // Системные сообщения могут не иметь sender - это нормально
  if (!message.sender || message.sender.value === undefined) {
    return null
  }
  return typeof message.sender.value === 'object' 
    ? message.sender.value.id 
    : message.sender.value
}

export interface MessagePage {
  messages: ApiMessage[]
  hasOlder: boolean
  nextPage: number | null
}

const MESSAGE_PAGE_SIZE = 15

export class MessagesApi {
  /**
   * Fetch a page from newest to oldest, then normalize it for chronological UI rendering.
   */
  static async fetchByAppointment(appointmentId: number, page = 1): Promise<MessagePage> {
    const data = await apiFetch<PayloadListResponse<ApiMessage>>(
      `/api/messages?where[appointment][equals]=${appointmentId}&sort=-createdAt&limit=${MESSAGE_PAGE_SIZE}&page=${page}&depth=1`,
      { credentials: 'include' }
    )
    return {
      messages: [...data.docs].reverse(),
      hasOlder: data.hasNextPage,
      nextPage: data.nextPage,
    }
  }

  /**
   * Get unread message count for an appointment (messages from the other party)
   */
  static async getUnreadCount(appointmentId: number, senderType: 'user' | 'doctor'): Promise<number> {
    // Get messages NOT from the current sender type that are unread
    // С полиморфной связью: sender.relationTo указывает на коллекцию
    const otherRelationTo = senderType === 'user' ? 'doctors' : 'users'
    const data = await apiFetch<PayloadListResponse<ApiMessage>>(
      `/api/messages?where[appointment][equals]=${appointmentId}&where[sender.relationTo][equals]=${otherRelationTo}&where[read][equals]=false&limit=0&depth=1`,
      { credentials: 'include' }
    )
    return data.totalDocs
  }

  /**
   * Get last message for an appointment
   */
  static async getLastMessage(appointmentId: number): Promise<ApiMessage | null> {
    const data = await apiFetch<PayloadListResponse<ApiMessage>>(
      `/api/messages?where[appointment][equals]=${appointmentId}&sort=-createdAt&limit=1&depth=1`,
      { credentials: 'include' }
    )
    return data.docs[0] || null
  }

  /**
   * Fetch messages for a specific appointment (server-side)
   */
  static async fetchByAppointmentServer(appointmentId: number, options: { cookie?: string } = {}): Promise<ApiMessage[]> {
    const data = await serverApiFetch<PayloadListResponse<ApiMessage>>(
      `/api/messages?where[appointment][equals]=${appointmentId}&sort=createdAt&limit=500&depth=1`,
      { ...options, cache: 'no-store' }
    )
    return data.docs
  }
}
