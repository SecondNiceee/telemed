import type { Socket } from 'socket.io-client'

export type Ack<T = Record<string, never>> = ({ success: true } & T) | { success: false; error: string }

export interface TokenData {
  token: string
  roomId: string
  peerId: string
  role: 'doctor' | 'patient'
  peerName: string
  iceServers: RTCIceServer[]
}

const ackTimeout = 10_000
export const INTERNET_CONNECTION_ERROR = 'Нет подключения к интернету'
const CONNECTION_LOST_ERROR = 'Связь с интернетом была потеряна'

/**
 * Ошибки просроченного пропуска в комнату.
 *
 * Токен из `/api/mediasoup/token` живёт 5 минут, а сокет переиспользует его при
 * каждом переподключении. Поэтому обрыв связи после этих 5 минут приводит к
 * отказу на `joinRoom`, и jsonwebtoken отдаёт своё техническое «jwt expired» —
 * оно доезжает до UI дословно через ack. Для пациента это означает ровно одно:
 * связь пропала и нужно переподключиться (кнопка «Повторить» берёт новый токен).
 */
const STALE_TOKEN_RE = /jwt (expired|malformed|must be provided)|invalid (signature|token)/i

export function getCallErrorMessage(reason: unknown, fallback = 'Ошибка подключения'): string {
  const message = reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : fallback
  if (STALE_TOKEN_RE.test(message)) return CONNECTION_LOST_ERROR
  const isConnectionError = /websocket|socket|network|track\s*ended|trackended|transport|timeout|disconnected|connection|fetch failed/i.test(message)
  return isConnectionError ? INTERNET_CONNECTION_ERROR : message
}

/**
 * Запрос к серверу с подтверждением.
 *
 * Помимо таймаута слушает 'disconnect': иначе обрыв связи оставлял бы вызов
 * висеть все 10 секунд, хотя ответа уже гарантированно не будет.
 */
export function emitAck<T>(socket: Socket, event: string, data: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      socket.off('disconnect', onDisconnect)
      callback()
    }
    const onDisconnect = () => finish(() => reject(new Error(`${event}: socket disconnected`)))
    const timer = window.setTimeout(() => finish(() => reject(new Error(`${event}: timeout`))), ackTimeout)
    socket.once('disconnect', onDisconnect)
    socket.emit(event, data, (response: Ack<T>) => finish(() => {
      if (!response?.success) reject(new Error(response?.error || `${event}: failed`))
      else resolve(response as T)
    }))
  })
}
