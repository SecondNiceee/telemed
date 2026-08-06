import type { ApiAppointment } from '@/lib/api/types'
import type { ApiMessageAttachment, ApiMessageSender } from '@/lib/api/messages'

export interface ChatWindowProps {
  appointment: ApiAppointment
  currentSenderType: 'user' | 'doctor'
  currentSenderId: number
  onBack?: () => void
  onAppointmentCompleted?: (appointmentId: number) => void
}

export type VideoSaveStatus = 'uploading' | 'processing' | 'saving' | 'done' | 'error' | null
export type ConsultationType = 'video' | 'chat' | null

export interface ChatHeaderProps {
  appointment: ApiAppointment
  currentSenderType: 'user' | 'doctor'
  currentSenderId: number
  otherPartyName: string
  localStatus: string
  isCompleted: boolean
  isConnected: boolean
  consultationType: ConsultationType
  countdownParts: { days: number; hours: number; minutes: number; seconds: number; total: number } | null
  videoCallStatus: string
  isChatBlocked?: boolean
  hasFeedback?: boolean
  connectionType?: 'chat' | 'audio' | 'video' | null
  onBack?: () => void
  onStartConsultation: () => void
  onStartVideoCall: () => void
  onStartAudioCall: () => void
  onShowCompleteDialog: () => void
  onToggleChatBlock: () => void
  onLeaveFeedback?: () => void
  onChangeConnectionType?: (connectionType: 'chat' | 'audio' | 'video') => void
}

export interface ChatMessagesProps {
  appointmentId: number
  messages: Array<{
    id: number
    text?: string | null
    attachment?: ApiMessageAttachment | number | null
    sender?: ApiMessageSender | null
    createdAt?: string
    read?: boolean
    isSystemMessage?: boolean
  }>
  currentSenderType: 'user' | 'doctor'
  currentSenderId: number
  otherPartyName: string
  isLoading: boolean
  typingUser: { senderType: string } | null | undefined
  recording?: { url?: string } | null
}

export interface ChatInputProps {
  appointmentId: number
  isConnected: boolean
  canSendMessages: boolean
  isCompleted: boolean
  isChatBlocked?: boolean
  currentSenderType: 'user' | 'doctor'
  onSendMessage: (text: string, attachmentId?: number) => void
  onStartTyping: () => void
  onStopTyping: () => void
  // External attachment from drag-drop
  externalAttachment?: ApiMessageAttachment | null
  externalSelectedFile?: File | null
  externalIsUploading?: boolean
  onRemoveExternalAttachment?: () => void
}

export interface VideoSaveSidebarProps {
  isVisible: boolean
  progress: number
  status: VideoSaveStatus
}

export interface ConsultationDialogsProps {
  showCompleteDialog: boolean
  showConsultationTypeDialog: boolean
  isCompleting: boolean
  connectionType?: 'chat' | 'audio' | 'video' | null
  onCompleteDialogChange: (open: boolean) => void
  onConsultationTypeDialogChange: (open: boolean) => void
  onComplete: () => void
  onStartVideoConsultation: () => void
  onStartAudioConsultation: () => void
  onStartChatConsultation: () => void
}
