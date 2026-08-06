/**
 * Video Call Configuration
 * PeerJS server runs on port 3002
 * TURN servers provided by Metered (relay.metered.ca)
 */

export const PEER_SERVER_CONFIG = {
  host: typeof window !== 'undefined' ? window.location.hostname : 'localhost',
  port: 3002,
  path: '/peerjs',
  secure: typeof window !== 'undefined' && window.location.protocol === 'https:',
  debug: process.env.NODE_ENV === 'development' ? 2 : 0,
} as const

export const ICE_SERVERS = [
  // STUN server (Metered)
  { urls: 'stun:stun.relay.metered.ca:80' },
  // TURN servers (Metered)
  {
    urls: 'turn:global.relay.metered.ca:80',
    username: 'ac5baa70fa3a741d981527dd',
    credential: 'GQ8uoHDchehPcagM',
  },
  {
    urls: 'turn:global.relay.metered.ca:80?transport=tcp',
    username: 'ac5baa70fa3a741d981527dd',
    credential: 'GQ8uoHDchehPcagM',
  },
  {
    urls: 'turn:global.relay.metered.ca:443',
    username: 'ac5baa70fa3a741d981527dd',
    credential: 'GQ8uoHDchehPcagM',
  },
  {
    urls: 'turns:global.relay.metered.ca:443?transport=tcp',
    username: 'ac5baa70fa3a741d981527dd',
    credential: 'GQ8uoHDchehPcagM',
  },
] as const

export const CALL_TIMEOUTS = {
  /** Время ожидания ответа на звонок (30 сек) */
  CALL_TIMEOUT: 30000,
  /** Интервал переподключения (2 сек) */
  RECONNECT_INTERVAL: 2000,
  /** Максимальное количество попыток переподключения */
  MAX_RECONNECT_ATTEMPTS: 3,
  /** Интервал проверки качества соединения (3 сек) */
  QUALITY_CHECK_INTERVAL: 3000,
  /** Timeout для TURN теста (5 сек) */
  TURN_TEST_TIMEOUT: 5000,
  /** Задержка перед повторной попыткой получить media (1 сек) */
  MEDIA_RETRY_DELAY: 1000,
} as const

export const MEDIA_CONSTRAINTS = {
  video: {
    ideal: {
      width: { ideal: 1280, min: 320 },
      height: { ideal: 720, min: 240 },
      frameRate: { ideal: 30, min: 15 },
    },
    fallback: {
      width: { ideal: 640, min: 320 },
      height: { ideal: 480, min: 240 },
      frameRate: { ideal: 24, min: 15 },
    },
    // Minimal constraints - just request any video
    minimal: true,
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
} as const

export const CALL_TIMER = {
  /** Время до окончания когда таймер становится жёлтым (5 мин) */
  WARNING_THRESHOLD_SECONDS: 5 * 60,
  /** Время до окончания когда таймер становится красным (1 мин) */
  CRITICAL_THRESHOLD_SECONDS: 60,
} as const
