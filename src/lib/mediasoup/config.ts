/**
 * MediaSoup Server Configuration
 * 
 * This configuration is used for the SFU (Selective Forwarding Unit) server.
 * The server handles WebRTC media routing and enables server-side recording.
 */

import type { types as mediasoupTypes } from 'mediasoup'
import path from 'path'

type WorkerSettings = mediasoupTypes.WorkerSettings
type RouterOptions = mediasoupTypes.RouterOptions
type WebRtcServerOptions = mediasoupTypes.WebRtcServerOptions
type WebRtcTransportOptions = mediasoupTypes.WebRtcTransportOptions
import os from 'os'

// Get the server's public IP - will be set from environment or detected
// Can be either an IP address or a domain name
const ANNOUNCED_IP = process.env.MEDIASOUP_ANNOUNCED_IP || '127.0.0.1'
const LISTEN_IP = process.env.MEDIASOUP_LISTEN_IP || '0.0.0.0'

// Log the configuration on startup for debugging
console.log('[MediaSoup Config] ANNOUNCED_IP:', ANNOUNCED_IP)
console.log('[MediaSoup Config] LISTEN_IP:', LISTEN_IP)
console.log('[MediaSoup Config] WEBRTC_PORT:', process.env.MEDIASOUP_WEBRTC_PORT || '13478')

/**
 * MediaSoup Worker settings
 * Workers are separate processes that handle media
 * 
 * With WebRtcServer enabled, ALL transports share a SINGLE port (40000).
 * This is much simpler than the old approach with port ranges.
 * 
 * rtcMinPort/rtcMaxPort are only used as fallback if WebRtcServer fails.
 */
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
  // Fallback port range (only used if WebRtcServer is disabled)
  rtcMinPort: parseInt(process.env.MEDIASOUP_RTC_MIN_PORT || '13478', 10),
  rtcMaxPort: parseInt(process.env.MEDIASOUP_RTC_MAX_PORT || '13578', 10),
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
 * Single port for ALL WebRTC connections (via WebRtcServer)
 * 
 * This is the key optimization - instead of 1 port per transport,
 * ALL transports share this single port. Supports unlimited concurrent calls!
 * 
 * Default: 13478 (UDP + TCP)
 * 
 * Firewall rule needed: sudo ufw allow 13478/udp && sudo ufw allow 13478/tcp
 */
export const WEBRTC_SERVER_PORT = parseInt(process.env.MEDIASOUP_WEBRTC_PORT || '13478', 10)

export const webRtcServerOptions: WebRtcServerOptions = {
  listenInfos: [
    {
      protocol: 'udp',
      ip: LISTEN_IP,
      announcedAddress: ANNOUNCED_IP,
      port: WEBRTC_SERVER_PORT,
    },
    {
      protocol: 'tcp',
      ip: LISTEN_IP,
      announcedAddress: ANNOUNCED_IP,
      port: WEBRTC_SERVER_PORT,
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
 * Default path uses path.join to create a folder in the project root.
 * You can override with RECORDING_OUTPUT_DIR env variable.
 */
export const recordingConfig = {
  // Directory to store temporary recordings (before upload to Payload)
  // Default: ./mediasoup-recordings in project root
  outputDir: process.env.RECORDING_OUTPUT_DIR || path.join(process.cwd(), 'mediasoup-recordings'),
  // FFmpeg path
  ffmpegPath: process.env.FFMPEG_PATH || 'ffmpeg',
  // Recording format
  format: 'webm',
  // Video codec for recording
  videoCodec: 'libvpx-vp9',
  // Audio codec for recording
  audioCodec: 'libopus',
}
