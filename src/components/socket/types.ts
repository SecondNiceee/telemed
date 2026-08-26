import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { Socket } from 'socket.io-client'
import type { useChatStore } from '@/stores/chat-store'
import type { OutgoingCallStatus } from './outgoing-call-status'

export interface IncomingCall {
  appointmentId: number
  callId: string
  callerName: string
  isAudioOnly: boolean
}

export interface SocketContextValue {
  socket: Socket | null
  isConnected: boolean
  hasConnectionError: boolean
  outgoingCallStatuses: Record<string, OutgoingCallStatus>
  joinRoom: (appointmentId: number) => void
  leaveRoom: (appointmentId: number) => void
  sendMessage: (appointmentId: number, text: string, attachmentId?: number, clientMessageId?: string) => Promise<void>
  markAsRead: (appointmentId: number) => void
  startTyping: (appointmentId: number) => void
  stopTyping: (appointmentId: number) => void
  // Video call signaling
  initiateCall: (appointmentId: number, callerPeerId: string, callerName: string, isAudioOnly?: boolean) => string | null
  answerCall: (appointmentId: number, callId: string, answerPeerId: string) => void
  rejectCall: (appointmentId: number, callId: string) => void
  endCall: (appointmentId: number, callId?: string) => void
  /** Активно ли ещё приглашение. null - сервер не ответил. */
  getCallState: (appointmentId: number, callId: string) => Promise<{ pending: boolean } | null>
  // Callback for when remote party ends call (before store is updated)
  // Callback can be async - socket-provider will await it before updating store
  onRemoteCallEnded: (callback: (appointmentId: number) => void | Promise<void>) => () => void
  // Consultation management
  startConsultation: (appointmentId: number) => void
  endConsultation: (appointmentId: number) => void
  cancelConsultation: (appointmentId: number) => void
  blockChat: (appointmentId: number) => void
  unblockChat: (appointmentId: number) => void
  changeConnectionType: (appointmentId: number, connectionType: 'chat' | 'audio' | 'video') => void
}

type ChatStoreState = ReturnType<typeof useChatStore.getState>

/**
 * То, к чему обработчики событий обращаются вместо замыканий на состояние.
 *
 * Всё приходит рефами не для удобства: обработчики регистрируются один раз в
 * useEffect с пустым списком зависимостей, потому что пересоздание сокета на
 * каждое изменение стора рвало бы соединение. Рефы дают им доступ к свежим
 * значениям без этой пересборки.
 */
export interface SocketHandlerDeps {
  chatStoreRef: RefObject<ChatStoreState>
  currentSenderTypeRef: RefObject<'user' | 'doctor' | undefined>
  currentSenderIdRef: RefObject<number | undefined>
}

export interface CallHandlerDeps extends SocketHandlerDeps {
  setIncomingCall: Dispatch<SetStateAction<IncomingCall | null>>
  remoteCallEndedCallbacksRef: RefObject<Set<(appointmentId: number) => void | Promise<void>>>
}
