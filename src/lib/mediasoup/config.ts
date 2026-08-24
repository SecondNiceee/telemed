/**
 * MediaSoup Server Configuration
 * 
 * This configuration is used for the SFU (Selective Forwarding Unit) server.
 * The server handles WebRTC media routing and enables server-side recording.
 */

import type { types as mediasoupTypes } from 'mediasoup'

type WorkerSettings = mediasoupTypes.WorkerSettings
type RouterOptions = mediasoupTypes.RouterOptions
type WebRtcTransportOptions = mediasoupTypes.WebRtcTransportOptions
import os from 'os'

// Get the server's public IP - will be set from environment or detected
// Can be either an IP address or a domain name
const ANNOUNCED_IP = process.env.MEDIASOUP_ANNOUNCED_IP || '127.0.0.1'
const LISTEN_IP = process.env.MEDIASOUP_LISTEN_IP || '0.0.0.0'

const RTC_MIN_PORT = parseInt(process.env.MEDIASOUP_RTC_MIN_PORT || '40000', 10)
const RTC_MAX_PORT = parseInt(process.env.MEDIASOUP_RTC_MAX_PORT || '49999', 10)

if (!Number.isInteger(RTC_MIN_PORT) || !Number.isInteger(RTC_MAX_PORT) || RTC_MIN_PORT > RTC_MAX_PORT) {
  throw new Error('Invalid MediaSoup RTC port range')
}

console.log('[MediaSoup Config] ANNOUNCED_IP:', ANNOUNCED_IP)
console.log('[MediaSoup Config] LISTEN_IP:', LISTEN_IP)
console.log('[MediaSoup Config] RTC_PORT_RANGE:', `${RTC_MIN_PORT}-${RTC_MAX_PORT}`)

/**
 * MediaSoup Worker settings
 * Workers are separate processes that handle media routing.
 *
 * PORT RANGE MODE:
 * Each WebRTC transport binds a port from the [rtcMinPort, rtcMaxPort] range.
 * Open the whole range for TCP and UDP in the firewall, e.g.
 *   sudo ufw allow 40000:49999/udp && sudo ufw allow 40000:49999/tcp
 */
export const RTC_MIN_PORT_VALUE = RTC_MIN_PORT
export const RTC_MAX_PORT_VALUE = RTC_MAX_PORT

export const workerSettings: WorkerSettings = {
  logLevel: (process.env.MEDIASOUP_LOG_LEVEL as 'debug' | 'warn' | 'error' | 'none') || 'warn',
  logTags: [
    'info',
    'ice',
    'dtls',
    'rtp',
    'srtp',
    'rtcp',
  ],
  rtcMinPort: RTC_MIN_PORT,
  rtcMaxPort: RTC_MAX_PORT,
}

/**
 * Number of MediaSoup workers to create
 * Usually equal to the number of CPU cores
 */
export const numWorkers = Math.min(
  parseInt(process.env.MEDIASOUP_NUM_WORKERS || '0', 10) || os.cpus().length,
  os.cpus().length
)

/**
 * Router options - defines media codecs supported by the server
 */
export const routerOptions: RouterOptions = {
  mediaCodecs: [
    {
      kind: 'audio',
      mimeType: 'audio/opus',
      clockRate: 48000,
      channels: 2,
    },
    {
      kind: 'video',
      mimeType: 'video/VP8',
      clockRate: 90000,
      parameters: {
        'x-google-start-bitrate': 1000,
      },
    },
    {
      kind: 'video',
      mimeType: 'video/VP9',
      clockRate: 90000,
      parameters: {
        'profile-id': 2,
        'x-google-start-bitrate': 1000,
      },
    },
    {
      kind: 'video',
      mimeType: 'video/h264',
      clockRate: 90000,
      parameters: {
        'packetization-mode': 1,
        'profile-level-id': '4d0032',
        'level-asymmetry-allowed': 1,
        'x-google-start-bitrate': 1000,
      },
    },
    {
      kind: 'video',
      mimeType: 'video/h264',
      clockRate: 90000,
      parameters: {
        'packetization-mode': 1,
        'profile-level-id': '42e01f',
        'level-asymmetry-allowed': 1,
        'x-google-start-bitrate': 1000,
      },
    },
  ],
}

/**
 * WebRTC Transport options
 */
export const webRtcTransportOptions: WebRtcTransportOptions = {
  listenInfos: [
    {
      protocol: 'udp',
      ip: LISTEN_IP,
      announcedAddress: ANNOUNCED_IP,
    },
    {
      protocol: 'tcp',
      ip: LISTEN_IP,
      announcedAddress: ANNOUNCED_IP,
    },
  ],
  enableUdp: true,
  enableTcp: true,
  preferUdp: true,
  initialAvailableOutgoingBitrate: 1000000,
  maxSctpMessageSize: 262144,
}

/**
 * Plain RTP Transport options (for recording with FFmpeg)
 */
export const plainTransportOptions = {
  listenInfo: {
    protocol: 'udp' as const,
    ip: LISTEN_IP,
    announcedAddress: ANNOUNCED_IP,
  },
  rtcpMux: false,
  comedia: false,
}

/**
 * Server configuration
 */
export const serverConfig = {
  port: parseInt(process.env.MEDIASOUP_PORT || '3002', 10),
  corsOrigins: process.env.MEDIASOUP_CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'https://smartcardio.ru'],
}

/**
 * Recording configuration
 * 
 * NOTE: outputDir is a TEMPORARY directory for FFmpeg to write files.
 * After recording stops, the file is uploaded to Payload CMS Media collection
 * and the temp file is deleted.
 * 
 * You can override with RECORDING_OUTPUT_DIR env variable.
 */
export const recordingConfig = {
  // Серверная запись (PlainTransport + FFmpeg) ОТКЛЮЧЕНА: запись ведётся в
  // браузере врача (src/hooks/use-call-recorder.ts). Причина - FFmpeg-схема
  // требовала синхронизировать 4 независимых RTP-потока, и любой обрыв
  // (выход участника, выключенная камера) ломал контейнер или уводил
  // дорожки в рассинхрон. Включить обратно: RECORDING_SERVER_SIDE=1
  // (тогда на одну консультацию появятся ДВЕ записи).
  enabled: process.env.RECORDING_SERVER_SIDE === '1',
  // Directory to store temporary recordings (before upload to Payload).
  // Must match the default in app/api/mediasoup-recording/finalize-server.
  outputDir: process.env.RECORDING_OUTPUT_DIR || '/tmp/mediasoup-recordings',
  // FFmpeg path
  ffmpegPath: process.env.FFMPEG_PATH || 'ffmpeg',
  // Recording format
  format: 'webm',
  // Video codec for recording (VP8 realtime is fast enough for live encoding)
  videoCodec: 'libvpx',
  // Audio codec for recording
  audioCodec: 'libopus',
}

/**
 * Finalization: where the mediasoup server uploads finished recordings.
 */
export const recordingFinalizeConfig = {
  nextjsUrl: (process.env.NEXTJS_URL || 'http://localhost:3000').replace(/\/$/, ''),
  serverSecret: process.env.MEDIASOUP_SERVER_SECRET || '',
}
