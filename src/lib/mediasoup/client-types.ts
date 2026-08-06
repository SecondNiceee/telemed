/**
 * MediaSoup Client Types
 * 
 * Shared types for mediasoup-client integration.
 */

import type { types as mediasoupTypes } from 'mediasoup-client'

type RtpCapabilities = mediasoupTypes.RtpCapabilities
type RtpParameters = mediasoupTypes.RtpParameters
type DtlsParameters = mediasoupTypes.DtlsParameters

/**
 * Socket events sent TO the MediaSoup server
 */
export interface MediasoupClientToServerEvents {
  'join-room': (
    data: {
      roomId: string
      peerId: string
      peerName: string
      role: 'doctor' | 'patient'
    },
    callback: (response: JoinRoomResponse) => void
  ) => void

  'leave-room': (data: { roomId: string }) => void

  'create-transport': (
    data: {
      roomId: string
      direction: 'send' | 'recv'
    },
    callback: (response: CreateTransportResponse) => void
  ) => void

  'connect-transport': (
    data: {
      roomId: string
      transportId: string
      dtlsParameters: DtlsParameters
    },
    callback: (response: { success: boolean; error?: string }) => void
  ) => void

  'produce': (
    data: {
      roomId: string
      transportId: string
      kind: 'audio' | 'video'
      rtpParameters: RtpParameters
      appData?: Record<string, unknown>
    },
    callback: (response: ProduceResponse) => void
  ) => void

  'set-rtp-capabilities': (data: { rtpCapabilities: RtpCapabilities }) => void

  'consume': (
    data: {
      roomId: string
      producerId: string
      producerPeerId: string
    },
    callback: (response: ConsumeResponse) => void
  ) => void

  'resume-consumer': (
    data: {
      roomId: string
      consumerId: string
    },
    callback: (response: { success: boolean; error?: string }) => void
  ) => void

  'get-producers': (
    data: { roomId: string },
    callback: (response: GetProducersResponse) => void
  ) => void

  'start-recording': (
    data: { roomId: string },
    callback: (response: StartRecordingResponse) => void
  ) => void

  'stop-recording': (
    data: { roomId: string },
    callback: (response: StopRecordingResponse) => void
  ) => void

  'get-recording-status': (
    data: { roomId: string },
    callback: (response: GetRecordingStatusResponse) => void
  ) => void
}

/**
 * Socket events received FROM the MediaSoup server
 */
export interface MediasoupServerToClientEvents {
  'peer-joined': (data: {
    peerId: string
    peerName: string
    role: 'doctor' | 'patient'
  }) => void

  'peer-left': (data: { peerId: string }) => void

  'new-producer': (data: {
    producerId: string
    producerPeerId: string
    kind: 'audio' | 'video'
  }) => void

  'recording-started': (data: {
    sessionId: string
    startedBy: string
  }) => void

  'recording-stopped': (data: {
    sessionId: string
    filePath: string
    reason?: 'doctor-disconnected' | 'manual'
  }) => void
}

/**
 * Response types
 */
export interface JoinRoomResponse {
  success: boolean
  routerRtpCapabilities?: RtpCapabilities
  error?: string
}

export interface CreateTransportResponse {
  success: boolean
  transport?: {
    id: string
    iceParameters: unknown
    iceCandidates: unknown
    dtlsParameters: unknown
    sctpParameters?: unknown
  }
  error?: string
}

export interface ProduceResponse {
  success: boolean
  producerId?: string
  error?: string
}

export interface ConsumeResponse {
  success: boolean
  consumer?: {
    id: string
    producerId: string
    kind: 'audio' | 'video'
    rtpParameters: RtpParameters
    producerPaused: boolean
  }
  error?: string
}

export interface GetProducersResponse {
  success: boolean
  producers?: Array<{
    producerId: string
    producerPeerId: string
    kind: 'audio' | 'video'
  }>
  error?: string
}

export interface StartRecordingResponse {
  success: boolean
  sessionId?: string
  error?: string
}

export interface StopRecordingResponse {
  success: boolean
  filePath?: string
  error?: string
}

export interface GetRecordingStatusResponse {
  success: boolean
  isRecording: boolean
  sessionId?: string
  startedAt?: string
  error?: string
}

/**
 * Mediasoup client state
 */
export interface MediasoupClientState {
  isConnected: boolean
  isConnecting: boolean
  roomId: string | null
  peerId: string | null
  error: Error | null
}

/**
 * Producer info
 */
export interface ProducerInfo {
  id: string
  kind: 'audio' | 'video'
  paused: boolean
}

/**
 * Consumer info
 */
export interface ConsumerInfo {
  id: string
  producerId: string
  producerPeerId: string
  kind: 'audio' | 'video'
  paused: boolean
}

/**
 * Room participant info
 */
export interface RoomParticipant {
  peerId: string
  peerName: string
  role: 'doctor' | 'patient'
  producers: ProducerInfo[]
  stream?: MediaStream
}
