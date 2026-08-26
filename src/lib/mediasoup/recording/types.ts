/**
 * Типы серверной записи. Отдельный файл, чтобы модули записи могли ссылаться
 * друг на друга через типы, не образуя циклических импортов кода.
 */

import type { ChildProcess } from 'child_process'
import type { types as mediasoupTypes } from 'mediasoup'

export type Router = mediasoupTypes.Router
export type Producer = mediasoupTypes.Producer
export type PlainTransport = mediasoupTypes.PlainTransport
export type Consumer = mediasoupTypes.Consumer

/** Один медиапоток одного участника: свой порт, свой SDP, свой FFmpeg, свой файл */
export interface RecordingInput {
  producerId: string
  kind: 'audio' | 'video'
  /** Читаемая метка для логов и раскладки: a-video, b-video, a-audio, b-audio */
  label: string
  /** Порядок участника: 0 - левое окно, 1 - правое окно */
  slot: 0 | 1
  transport: PlainTransport
  consumer: Consumer
  rtpPort: number
  rtcpPort: number
  sdpPath: string
  rawPath: string
  ffmpeg: ChildProcess | null
  /**
   * Момент начала медиа этой дорожки по часам mediasoup-воркера (мс).
   * Все дорожки замеряются одним и тем же клоком, поэтому разности
   * корректны - именно они превращаются в -itsoffset на этапе склейки.
   */
  startTs: number | null
  /** Резервный замер по часам Node, если trace не дал timestamp */
  startTsFallback: number | null
}

/** Producers of one participant to include in a segment */
export interface ParticipantProducers {
  peerId: string
  audio: Producer
  video?: Producer
}

export interface RecordingSession {
  id: string
  roomId: string
  appointmentId: number | null
  recordingType: 'video' | 'audio'
  startedAt: Date
  status: 'starting' | 'recording' | 'stopping' | 'composing' | 'completed' | 'failed'
  filePath: string
  durationSeconds: number
  inputs: RecordingInput[]
  keyFrameTimer: NodeJS.Timeout | null
  /**
   * Участник переопубликовал дорожки посреди сегмента (реконнект), поэтому
   * сегмент закрывается и начинается новый. Флаг нужен, чтобы перезапуск
   * произошёл один раз, а не на каждый закрытый продюсер.
   */
  interrupted: boolean
  error?: string
}
