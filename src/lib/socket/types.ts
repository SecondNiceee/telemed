import type Peer from 'peerjs'
import type { MediaConnection } from 'peerjs'
import type { Socket } from 'socket.io'

/**
 * Socket with authentication data
 */
export interface AuthenticatedSocket extends Socket {
  data: {
    senderType: 'doctor' | 'user'
    senderId: number
    userId?: number
    doctorId?: number
    typingInRooms: Set<string>
  }
}

/**
 * Payload types for socket events
 */
export interface JoinRoomPayload {
  appointmentId: number
}

export interface LeaveRoomPayload {
  appointmentId: number
}

export interface SendMessagePayload {
  appointmentId: number
  text: string
  preferredSenderType?: 'doctor' | 'user'
  attachmentId?: string
}

export interface MarkReadPayload {
  appointmentId: number
  messageIds: string[]
  preferredSenderType?: 'doctor' | 'user'
}

export interface TypingPayload {
  appointmentId: number
  preferredSenderType?: 'doctor' | 'user'
}

export interface StopTypingPayload {
  appointmentId: number
  preferredSenderType?: 'doctor' | 'user'
}

export interface CallSignalPayload {
  appointmentId: number
  callerPeerId: string
  callerName: string
  isAudioOnly?: boolean
}

export interface CallAnswerPayload {
  appointmentId: number
  answerPeerId: string
}

export interface CallRejectPayload {
  appointmentId: number
}

export interface CallEndPayload {
  appointmentId: number
}

export interface CallParticipantLeavingPayload {
  appointmentId: number
  participantType: 'doctor' | 'user'
}

export interface CallParticipantRejoiningPayload {
  appointmentId: number
  participantType: 'doctor' | 'user'
  peerId: string
}

// Consultation status events
export interface ConsultationStartPayload {
  appointmentId: number
}

export interface ConsultationEndPayload {
  appointmentId: number
}

export interface ChatBlockPayload {
  appointmentId: number
}

export interface ChatUnblockPayload {
  appointmentId: number
}

export interface ChangeConnectionTypePayload {
  appointmentId: number
  connectionType: 'chat' | 'audio' | 'video'
}

/**
 * Состояние звонка
 */
export type CallStatus =
  | 'idle'
  | 'incoming'
  | 'calling'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'ended'
  | 'error'

/**
 * Качество соединения
 */
export type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'unknown'

/**
 * Режим отображения звонка
 */
export type CallViewMode = 'fullscreen' | 'minimized' | 'pip'

/**
 * Роль пользователя в звонке
 */
export type CallRole = 'doctor' | 'patient'

/**
 * Информация об участнике звонка
 */
export interface CallParticipant {
  odooUserId: number
  odooPartnerId: number
  odooPartnerName: string
  peerId: string
  basePeerId?: string // Peer ID without tab suffix, for socket signaling
  role: CallRole
  avatar?: string
}

/**
 * Данные звонка
 */
export interface CallData {
  appointmentId: number
  caller: CallParticipant
  callee: CallParticipant
  durationMinutes: number
  startedAt?: Date
}

/**
 * Состояние media stream
 */
export interface MediaState {
  isVideoEnabled: boolean
  isAudioEnabled: boolean
  isCameraAvailable: boolean
  isMicrophoneAvailable: boolean
}

/**
 * Статистика соединения
 */
export interface ConnectionStats {
  quality: ConnectionQuality
  packetLoss: number
  roundTripTime: number
  bandwidth?: number
}

/**
 * Props для LocalVideo компонента
 */
export interface LocalVideoProps {
  stream: MediaStream | null
  isVideoEnabled: boolean
  isMinimized?: boolean
  className?: string
}

/**
 * Props для RemoteVideo компонента
 */
export interface RemoteVideoProps {
  stream: MediaStream | null
  participantName?: string
  className?: string
}

/**
 * Props для CallControls компонента
 */
export interface CallControlsProps {
  isVideoEnabled: boolean
  isAudioEnabled: boolean
  isCameraAvailable: boolean
  isMicrophoneAvailable: boolean
  onToggleVideo: () => void
  onToggleAudio: () => void
  onEndCall: () => void
  onToggleMinimize?: () => void
  isMinimized?: boolean
}

/**
 * Props для DoctorControls компонента
 */
export interface DoctorControlsProps {
  isPaused: boolean
  onTogglePause: () => void
  onCompleteConsultation: () => void
  isRecording?: boolean
  onToggleRecording?: () => void
}

/**
 * Props для CallTimer компонента
 */
export interface CallTimerProps {
  remainingSeconds: number
  isPaused: boolean
  className?: string
}

/**
 * Props для ConnectionQuality компонента
 */
export interface ConnectionQualityProps {
  quality: ConnectionQuality
  showLabel?: boolean
  className?: string
}

/**
 * Props для IncomingCallView
 */
export interface IncomingCallViewProps {
  caller: CallParticipant
  onAccept: () => void
  onReject: () => void
}

/**
 * Props для CallingView
 */
export interface CallingViewProps {
  callee: CallParticipant
  onCancel: () => void
}

/**
 * Props для ConnectingView
 */
export interface ConnectingViewProps {
  participant: CallParticipant
}

/**
 * Props для ConnectedView
 */
export interface ConnectedViewProps {
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  participant: CallParticipant
  mediaState: MediaState
  connectionQuality: ConnectionQuality
  remainingSeconds: number
  isPaused: boolean
  isMinimized: boolean
  onToggleVideo: () => void
  onToggleAudio: () => void
  onEndCall: () => void
  onToggleMinimize: () => void
}

/**
 * Props для MinimizedView
 */
export interface MinimizedViewProps {
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  participantName: string
  remainingSeconds: number
  onExpand: () => void
  onEndCall: () => void
}

/**
 * Context value для VideoCallProvider
 */
export interface VideoCallContextValue {
  // Состояние
  status: CallStatus
  callData: CallData | null
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  mediaState: MediaState
  connectionQuality: ConnectionQuality
  viewMode: CallViewMode
  remainingSeconds: number
  isPaused: boolean
  peer: Peer | null
  currentCall: MediaConnection | null
  
  // Действия
  startCall: (callee: CallParticipant, appointmentId: number, durationMinutes: number) => Promise<void>
  answerCall: () => Promise<void>
  rejectCall: () => void
  endCall: () => void
  toggleVideo: () => void
  toggleAudio: () => void
  toggleMinimize: () => void
  togglePause: () => void
  completeConsultation: () => void
  
  // Информация о текущем пользователе
  currentUser: CallParticipant | null
  role: CallRole | null
}

/**
 * Socket события для звонков
 */
export interface CallSocketEvents {
  'call:incoming': (data: { callData: CallData }) => void
  'call:accepted': (data: { peerId: string }) => void
  'call:rejected': (data: { reason?: string }) => void
  'call:ended': (data: { appointmentId: number }) => void
  'call:missed': (data: { appointmentId: number }) => void
}

/**
 * Опции для usePeerConnection хука
 */
export interface UsePeerConnectionOptions {
  peerId: string
  onIncomingCall?: (call: MediaConnection, callerPeerId: string) => void
  onCallConnected?: (remoteStream: MediaStream) => void
  onCallEnded?: () => void
  onError?: (error: Error) => void
}

/**
 * Return type для usePeerConnection хука
 */
export interface UsePeerConnectionReturn {
  peer: Peer | null
  currentCall: MediaConnection | null
  isConnecting: boolean
  error: Error | null
  initPeer: () => Promise<Peer>
  makeCall: (remotePeerId: string, localStream: MediaStream) => Promise<MediaConnection>
  answerCall: (call: MediaConnection, localStream: MediaStream) => void
  endCall: () => void
  cleanup: () => void
}

/**
 * Return type для useMediaStream хука
 */
export interface UseMediaStreamReturn {
  stream: MediaStream | null
  isVideoEnabled: boolean
  isAudioEnabled: boolean
  isCameraAvailable: boolean
  isMicrophoneAvailable: boolean
  error: Error | null
  getStream: (video?: boolean, audio?: boolean) => Promise<MediaStream | null>
  toggleVideo: () => void
  toggleAudio: () => void
  replaceVideoTrack: (track: MediaStreamTrack) => void
  stopStream: () => void
}

/**
 * Return type для useCallTimer хука
 */
export interface UseCallTimerReturn {
  remainingSeconds: number
  isPaused: boolean
  isExpired: boolean
  formattedTime: string
  start: () => void
  pause: () => void
  resume: () => void
  reset: (durationMinutes: number) => void
}

/**
 * Return type для useConnectionQuality хука
 */
export interface UseConnectionQualityReturn {
  quality: ConnectionQuality
  stats: ConnectionStats | null
  startMonitoring: (peerConnection: RTCPeerConnection) => void
  stopMonitoring: () => void
}

/**
 * Return type для useCallRecording хука
 * 
 * startRecording now supports Picture-in-Picture composite recording:
 * - localStream: Doctor's camera (displayed as main view)
 * - remoteStream: Patient's camera (displayed as small PiP in corner)
 * - Both audio tracks are mixed into the final recording
 */
export interface UseCallRecordingReturn {
  isRecording: boolean
  recordingBlob: Blob | null
  isUploading: boolean
  startRecording: (
    localStream: MediaStream,
    appointmentId?: number,
    doctorId?: number,
    remoteStream?: MediaStream
  ) => void
  stopRecording: () => Promise<Blob | null>
  uploadRecording: (appointmentId: number, doctorId: number, blob?: Blob) => Promise<boolean>
  downloadRecording: (filename?: string) => void
}

/**
 * Return type для useTurnTest хука
 */
export interface UseTurnTestReturn {
  isTurnWorking: boolean | null
  isTestRunning: boolean
  testTurn: () => Promise<boolean>
}
