import type { Socket } from 'socket.io'

export interface AuthenticatedSocket extends Socket {
  data: {
    userId?: number
    doctorId?: number
    senderType: 'user' | 'doctor'
    senderId: number
    // Track rooms where user is typing (for cleanup on disconnect)
    typingInRooms: Set<string>
  }
}

export interface MessageAttachment {
  name: string
  size: number
  type: string
  url: string
}

export interface SendMessagePayload {
  appointmentId: number
  text?: string
  attachments?: MessageAttachment[]
  preferredSenderType?: 'user' | 'doctor'
}

export interface JoinRoomPayload {
  appointmentId: number
  preferredSenderType?: 'user' | 'doctor'
}

export interface MarkReadPayload {
  appointmentId: number
  preferredSenderType?: 'user' | 'doctor'
}
