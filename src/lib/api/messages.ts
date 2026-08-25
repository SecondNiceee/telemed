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

/**
 * Потолок выборки непрочитанных при подсчёте по кабинету. Индикатор — точка,
 * а не число, поэтому точный счёт за этим потолком ни на что не влияет:
 * важно лишь то, что непрочитанные есть.
 */
const UNREAD_SCAN_LIMIT = 200

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
   * Непрочитанные сообщения, адресованные текущему участнику, сгруппированные
   * по консультации. Нужно кабинетам (/lk, /lk-med), чтобы показать точку
   * «есть новое сообщение» сразу при загрузке страницы: счётчики в chat-store
   * живут только в памяти и на свежей загрузке всегда пустые.
   *
   * Один запрос на весь кабинет вместо запроса на каждую консультацию:
   * доступ к коллекции уже ограничен консультациями вызывающего
   * (см. access.read в Messages), поэтому дополнительно фильтровать по списку
   * id не требуется.
   *
   * Ошибку не пробрасываем: точка у чата не стоит того, чтобы из-за неё
   * падал весь кабинет.
   */
  static async fetchUnreadCountsServer(
    options: { cookie?: string; currentSenderType: 'user' | 'doctor' },
  ): Promise<Record<number, number>> {
    const { currentSenderType, ...requestOptions } = options
    // Полиморфная связь: интересуют сообщения от противоположной стороны.
    const otherRelationTo = currentSenderType === 'user' ? 'doctors' : 'users'

    try {
      const data = await serverApiFetch<PayloadListResponse<Pick<ApiMessage, 'appointment'>>>(
        `/api/messages?where[sender.relationTo][equals]=${otherRelationTo}&where[read][equals]=false&limit=${UNREAD_SCAN_LIMIT}&depth=0&select[appointment]=true`,
        { ...requestOptions, cache: 'no-store' },
      )

      const counts: Record<number, number> = {}
      for (const message of data.docs) {
        const appointmentId =
          typeof message.appointment === 'object' ? message.appointment?.id : message.appointment
        if (typeof appointmentId !== 'number') continue
        counts[appointmentId] = (counts[appointmentId] ?? 0) + 1
      }
      return counts
    } catch (err) {
      console.error('[v0] Failed to load unread message counts:', err)
      return {}
    }
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
