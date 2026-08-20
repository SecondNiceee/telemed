import type { Socket } from 'socket.io'

export interface AuthenticatedSocket extends Socket {
  data: {
    senderType: 'doctor' | 'user'
    senderId: number
    userId?: number
    doctorId?: number
    typingInRooms: Set<string>
  }
}

export interface JoinRoomPayload { appointmentId: number }
export interface LeaveRoomPayload { appointmentId: number }
export interface SendMessagePayload {
  appointmentId: number
  text: string
  preferredSenderType?: 'doctor' | 'user'
  attachmentId?: string
}
export interface MarkReadPayload { appointmentId: number; messageIds: string[]; preferredSenderType?: 'doctor' | 'user' }
export interface TypingPayload { appointmentId: number; preferredSenderType?: 'doctor' | 'user' }
export interface StopTypingPayload { appointmentId: number; preferredSenderType?: 'doctor' | 'user' }

/** Chat-socket invitation only. WebRTC media never travels through this protocol. */
export interface CallSignalPayload {
  appointmentId: number
  callerPeerId?: string
  callerName: string
  isAudioOnly?: boolean
}
export interface CallAnswerPayload { appointmentId: number; answerPeerId?: string }
export interface CallRejectPayload { appointmentId: number }
export interface CallEndPayload { appointmentId: number }
export interface CallParticipantLeavingPayload { appointmentId: number; participantType: 'doctor' | 'user' }
export interface CallParticipantRejoiningPayload { appointmentId: number; participantType: 'doctor' | 'user'; peerId?: string }

export interface ConsultationStartPayload { appointmentId: number }
export interface ConsultationEndPayload { appointmentId: number }
export interface ChatBlockPayload { appointmentId: number }
export interface ChatUnblockPayload { appointmentId: number }
export interface ChangeConnectionTypePayload { appointmentId: number; connectionType: 'chat' | 'audio' | 'video' }
