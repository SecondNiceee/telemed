'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Device, types } from 'mediasoup-client'
import { io, type Socket } from 'socket.io-client'
import { getStableMicrophone, type MicrophoneGate } from '@/lib/mediasoup/mic-gate'
import {
  QUALITY_POLL_MS,
  QUALITY_REPORT_INTERVAL_MS,
  UNKNOWN_QUALITY,
  readQualityCounters,
  summarizeQuality,
  type CallQualityLevel,
  type CallQualitySnapshot,
  type QualityCounters,
} from '@/lib/mediasoup/call-quality'

type Status = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed'
export type CallEndReason = 'participant-ended' | 'participant-disconnected'
export type RemotePresence = 'unknown' | 'present' | 'absent'
type Ack<T = Record<string, never>> = ({ success: true } & T) | { success: false; error: string }
interface TokenData {
  token: string
  roomId: string
  peerId: string
  role: 'doctor' | 'patient'
  peerName: string
  iceServers: RTCIceServer[]
}
interface RemoteMedia { peerId: string; stream: MediaStream }

const ackTimeout = 10_000
const INTERNET_CONNECTION_ERROR = 'Нет подключения к интернету'
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

function getCallErrorMessage(reason: unknown, fallback = 'Ошибка подключения'): string {
  const message = reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : fallback
  if (STALE_TOKEN_RE.test(message)) return CONNECTION_LOST_ERROR
  const isConnectionError = /websocket|socket|network|track\s*ended|trackended|transport|timeout|disconnected|connection|fetch failed/i.test(message)
  return isConnectionError ? INTERNET_CONNECTION_ERROR : message
}

function emitAck<T>(socket: Socket, event: string, data: unknown): Promise<T> {
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

export function useMediasoup(appointmentId: number, audioOnly = false) {
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteMedia, setRemoteMedia] = useState<RemoteMedia | null>(null)
  const [micEnabled, setMicEnabled] = useState(true)
  const [cameraEnabled, setCameraEnabled] = useState(!audioOnly)
  const [remoteMicEnabled, setRemoteMicEnabled] = useState(true)
  const [remoteCameraEnabled, setRemoteCameraEnabled] = useState(true)
  const [online, setOnline] = useState(true)
  const [endReason, setEndReason] = useState<CallEndReason | null>(null)
  const [quality, setQuality] = useState<CallQualitySnapshot>(UNKNOWN_QUALITY)
  // Есть ли в комнате второй участник. 'unknown' - пока не вошли и не спросили.
  const [remotePresence, setRemotePresence] = useState<RemotePresence>('unknown')

  const socketRef = useRef<Socket | null>(null)
  const tokenRef = useRef<TokenData | null>(null)
  const deviceRef = useRef<Device | null>(null)
  const sendRef = useRef<types.Transport | null>(null)
  const recvRef = useRef<types.Transport | null>(null)
  const producersRef = useRef(new Map<string, types.Producer>())
  const consumersRef = useRef(new Map<string, types.Consumer>())
  const remoteStreamsRef = useRef(new Map<string, MediaStream>())
  const micGateRef = useRef<MicrophoneGate | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const micEnabledRef = useRef(true)
  const cameraEnabledRef = useRef(!audioOnly)
  const rebuildingRef = useRef(false)
  const pendingJoinRef = useRef(false)
  const joinedSocketIdRef = useRef<string | null>(null)
  const leftRef = useRef(false)
  // Предыдущий снимок счётчиков: показатели считаются только по разнице.
  const qualityCountersRef = useRef<QualityCounters | null>(null)
  const qualityReportRef = useRef<{ level: CallQualityLevel; at: number }>({ level: 'unknown', at: 0 })

  const broadcastMediaState = useCallback(async () => {
    const socket = socketRef.current
    const token = tokenRef.current
    if (!socket?.connected || !token) return
    try {
      await emitAck(socket, 'mediaState', {
        roomId: token.roomId,
        micEnabled: micEnabledRef.current,
        cameraEnabled: cameraEnabledRef.current,
      })
    } catch {
      // Non-critical signal: the peer keeps its last known state.
    }
  }, [])

  /**
   * Отправляет оценку связи на сервер, чтобы плохое соединение было видно в
   * логах, а не только на экране участника.
   *
   * Без подтверждения: отчёт диагностический, и терять его не страшно. Ack
   * добавил бы таймауты ровно в тот момент, когда со связью и так плохо.
   */
  const reportQuality = useCallback((snapshot: CallQualitySnapshot) => {
    const socket = socketRef.current
    const token = tokenRef.current
    if (!socket?.connected || !token || snapshot.level === 'unknown') return

    const now = Date.now()
    const last = qualityReportRef.current
    // Смену уровня отправляем сразу, неизменную - по интервалу: иначе сервер
    // получал бы одинаковые отчёты каждые несколько секунд от каждого участника.
    if (last.level === snapshot.level && now - last.at < QUALITY_REPORT_INTERVAL_MS) return

    qualityReportRef.current = { level: snapshot.level, at: now }
    socket.emit('qualityReport', { roomId: token.roomId, ...snapshot })
  }, [])

  const restartIce = useCallback(async (transport: types.Transport) => {
    const socket = socketRef.current
    const token = tokenRef.current
    if (!socket || !token) return
    try {
      const response = await emitAck<{ iceParameters: types.IceParameters }>(socket, 'restartIce', { roomId: token.roomId, transportId: transport.id })
      await transport.restartIce({ iceParameters: response.iceParameters })
    } catch {
      setStatus('reconnecting')
      socket.disconnect().connect()
    }
  }, [])

  const wireTransport = useCallback((transport: types.Transport) => {
    transport.on('connectionstatechange', (state) => {
      if (state === 'connected') setStatus('connected')
      if (state === 'failed' || state === 'disconnected') void restartIce(transport)
    })
  }, [restartIce])

  const consume = useCallback(async (producerId: string, producerPeerId: string) => {
    const socket = socketRef.current
    const token = tokenRef.current
    const device = deviceRef.current
    const recv = recvRef.current
    if (
      !socket ||
      !token ||
      !device ||
      !recv ||
      !socket.id ||
      joinedSocketIdRef.current !== socket.id ||
      [...consumersRef.current.values()].some((item) => item.producerId === producerId)
    ) return

    const response = await emitAck<{ consumer: { id: string; producerId: string; kind: types.MediaKind; rtpParameters: types.RtpParameters } }>(socket, 'consume', {
      roomId: token.roomId,
      producerId,
      producerPeerId,
      rtpCapabilities: device.rtpCapabilities,
    })
    const consumer = await recv.consume(response.consumer)
    consumersRef.current.set(consumer.id, consumer)

    // Мутируем ОДИН постоянный MediaStream на пира вместо создания нового.
    // Раньше audio- и video-консюмеры из getProducers приходили через
    // Promise.all параллельно, оба читали previous как undefined и каждый
    // создавал поток только со своей дорожкой - побеждал последний. Из-за
    // этого в remoteMedia часто оставалось только видео, и запись уходила
    // без звука собеседника. Стабильная ссылка на поток также позволяет
    // <video> и рекордеру подхватывать дорожки, добавленные позже.
    let stream = remoteStreamsRef.current.get(producerPeerId)
    if (!stream) {
      stream = new MediaStream()
      remoteStreamsRef.current.set(producerPeerId, stream)
    }
    for (const track of stream.getTracks()) {
      if (track.kind === consumer.track.kind) stream.removeTrack(track)
    }
    stream.addTrack(consumer.track)
    // Новый объект-обёртка нужен, чтобы React увидел изменение.
    setRemoteMedia({ peerId: producerPeerId, stream })
    consumer.on('transportclose', () => consumersRef.current.delete(consumer.id))
    consumer.on('trackended', () => consumersRef.current.delete(consumer.id))
    await emitAck(socket, 'resumeConsumer', { roomId: token.roomId, consumerId: consumer.id })
  }, [])

  const createTransports = useCallback(async (socket: Socket, token: TokenData, device: Device) => {
    const sendData = await emitAck<{ transport: types.TransportOptions }>(socket, 'createWebRtcTransport', { roomId: token.roomId, direction: 'send' })
    const recvData = await emitAck<{ transport: types.TransportOptions }>(socket, 'createWebRtcTransport', { roomId: token.roomId, direction: 'recv' })
    const transportOptions = { iceServers: token.iceServers }
    const send = device.createSendTransport({ ...sendData.transport, ...transportOptions })
    const recv = device.createRecvTransport({ ...recvData.transport, ...transportOptions })

    send.on('connect', ({ dtlsParameters }, callback, errback) => {
      emitAck(socket, 'connectTransport', { roomId: token.roomId, transportId: send.id, dtlsParameters }).then(() => callback()).catch(errback)
    })
    recv.on('connect', ({ dtlsParameters }, callback, errback) => {
      emitAck(socket, 'connectTransport', { roomId: token.roomId, transportId: recv.id, dtlsParameters }).then(() => callback()).catch(errback)
    })
    send.on('produce', ({ kind, rtpParameters, appData }, callback, errback) => {
      emitAck<{ producerId: string }>(socket, 'produce', { roomId: token.roomId, transportId: send.id, kind, rtpParameters, appData })
        .then(({ producerId }) => callback({ id: producerId })).catch(errback)
    })
    wireTransport(send)
    wireTransport(recv)
    sendRef.current = send
    recvRef.current = recv
  }, [wireTransport])

  const ensureLiveLocalTracks = useCallback(async () => {
    const stream = localStreamRef.current
    if (!stream) return

    // A network switch (break-before-make) can end capture tracks. Reacquire them
    // before republishing so the rebuilt session sends live media again.
    const audioTrack = stream.getAudioTracks()[0]
    if (!audioTrack || audioTrack.readyState === 'ended') {
      micGateRef.current?.close()
      const mic = await getStableMicrophone()
      micGateRef.current = mic
      mic.setEnabled(micEnabledRef.current)
      if (audioTrack) stream.removeTrack(audioTrack)
      stream.addTrack(mic.track)
    }

    if (!audioOnly) {
      const videoTrack = stream.getVideoTracks()[0]
      if (!videoTrack || videoTrack.readyState === 'ended') {
        const camera = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
        const freshTrack = camera.getVideoTracks()[0]
        if (freshTrack) {
          freshTrack.enabled = cameraEnabledRef.current
          if (videoTrack) stream.removeTrack(videoTrack)
          stream.addTrack(freshTrack)
        }
      }
    }

    localStreamRef.current = stream
    setLocalStream(new MediaStream(stream.getTracks()))
  }, [audioOnly])

  const publishLocalTracks = useCallback(async () => {
    await ensureLiveLocalTracks()
    const send = sendRef.current
    const stream = localStreamRef.current
    if (!send || !stream) return
    for (const track of stream.getTracks()) {
      const key = track.kind === 'audio' ? 'mic' : 'camera'
      if (producersRef.current.has(key)) continue
      // stopTracks: false keeps the capture alive when producers are closed
      // during a session rebuild, so tracks survive network switches.
      const producer = await send.produce({
        track,
        appData: { source: key },
        stopTracks: false,
        ...(key === 'camera'
          ? {
              // Simulcast: the SFU switches layers instead of the encoder
              // collapsing to a single degraded stream on bad networks, and
              // quality recovers instantly after pause/resume.
              encodings: [
                { maxBitrate: 300_000, scaleResolutionDownBy: 4 },
                { maxBitrate: 900_000, scaleResolutionDownBy: 2 },
                { maxBitrate: 2_500_000, scaleResolutionDownBy: 1 },
              ],
              codecOptions: { videoGoogleStartBitrate: 1000 },
            }
          : {
              // FEC восстанавливает звук на потерях - оставляем.
              //
              // opusDtx СПЕЦИАЛЬНО ВЫКЛЮЧЕН. В режиме DTX кодировщик почти
              // ничего не передаёт, пока участник молчит, и для живого звонка
              // это чистая экономия. Но для ЗАПИСИ дорожка того, кто в основном
              // слушает (обычно пациент), превращается в набор коротких
              // всплесков с многосекундными провалами: метки ставятся по
              // времени прихода пакетов, поэтому такие провалы приходится
              // заполнять тишиной уже на склейке. Экономия - около 5 кбит/с,
              // цена - самая ценная часть записи. Оставляем непрерывный поток.
              codecOptions: { opusFec: true },
            }),
      })
      producersRef.current.set(key, producer)
      if (key === 'camera' && !cameraEnabledRef.current) await producer.pause()
    }
  }, [ensureLiveLocalTracks])

  const closeMediaSession = useCallback(() => {
    joinedSocketIdRef.current = null
    for (const consumer of consumersRef.current.values()) consumer.close()
    for (const producer of producersRef.current.values()) producer.close()
    consumersRef.current.clear()
    producersRef.current.clear()
    remoteStreamsRef.current.clear()
    sendRef.current?.close()
    recvRef.current?.close()
    sendRef.current = null
    recvRef.current = null
    deviceRef.current = null
    setRemoteMedia(null)
  }, [])

  const join = useCallback(async (socket: Socket, token: TokenData) => {
    pendingJoinRef.current = true
    if (rebuildingRef.current) return

    rebuildingRef.current = true
    try {
      while (pendingJoinRef.current && !leftRef.current) {
        pendingJoinRef.current = false
        const socketId = socket.id
        if (!socket.connected || !socketId) return

        setStatus('reconnecting')
        closeMediaSession()

        try {
          const joined = await emitAck<{ routerRtpCapabilities: types.RtpCapabilities; otherPeersOnline?: number }>(socket, 'joinRoom', token)

          // Сокет заменён более новым подключением: этот вход уже не нужен.
          // Раньше здесь стоял `continue` вместе с проверками ниже, и живой,
          // но осиротевший сокет крутил joinRoom без остановки - сервер
          // заливало логами `repeat=true` по несколько раз в секунду.
          if (socketRef.current !== socket) {
            socket.disconnect()
            return
          }

          // Сокет переподключается: повторный вход запустит обработчик
          // 'connect', ждать его в этом цикле нельзя - получится busy loop.
          if (!socket.connected || socket.id !== socketId) {
            pendingJoinRef.current = true
            return
          }
          // Сервер сразу говорит, есть ли в комнате живой собеседник. Без этого
          // нельзя отличить «жду, пока он войдёт» от «звонок давно закончился».
          setRemotePresence(joined.otherPeersOnline === undefined ? 'unknown' : joined.otherPeersOnline > 0 ? 'present' : 'absent')

          joinedSocketIdRef.current = socketId
          const { Device } = await import('mediasoup-client')
          const device = new Device()
          await device.load({ routerRtpCapabilities: joined.routerRtpCapabilities })
          if (joinedSocketIdRef.current !== socketId) continue

          deviceRef.current = device
          await createTransports(socket, token, device)
          if (joinedSocketIdRef.current !== socketId) continue

          await publishLocalTracks()
          const existing = await emitAck<{ producers: Array<{ producerId: string; producerPeerId: string }> }>(socket, 'getProducers', { roomId: token.roomId })
          if (joinedSocketIdRef.current !== socketId) continue

          await Promise.all(existing.producers.map((producer) => consume(producer.producerId, producer.producerPeerId)))
          if (joinedSocketIdRef.current === socketId) {
            setError(null)
            setStatus('connected')
            void broadcastMediaState()
          }
        } catch (reason) {
          // Вход сорвался из-за обрыва связи, а не из-за отказа сервера:
          // повторит обработчик 'connect', когда сокет вернётся.
          if (!socket.connected || socket.id !== socketId) {
            pendingJoinRef.current = true
            return
          }
          throw reason
        }
      }
    } finally {
      rebuildingRef.current = false
      if (pendingJoinRef.current && socket.connected && !leftRef.current) {
        void join(socket, token).catch((reason) => {
          setError(getCallErrorMessage(reason))
          setStatus('failed')
        })
      }
    }
  }, [broadcastMediaState, closeMediaSession, consume, createTransports, publishLocalTracks])

  const cleanup = useCallback(() => {
    leftRef.current = true
    pendingJoinRef.current = false
    socketRef.current?.disconnect()
    socketRef.current = null
    closeMediaSession()
    micGateRef.current?.close()
    micGateRef.current = null
    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    localStreamRef.current = null
    setLocalStream(null)
    setStatus('idle')
  }, [closeMediaSession])

  const leave = useCallback(() => {
    cleanup()
  }, [cleanup])

  const endCall = useCallback(async () => {
    const socket = socketRef.current
    const token = tokenRef.current
    if (socket?.connected && token) {
      try {
        await emitAck(socket, 'endCall', { roomId: token.roomId })
      } catch {
        // Cleanup locally even if the acknowledgement is lost. The server's
        // disconnect grace timer will still notify the other participant.
      }
    }
    cleanup()
  }, [cleanup])

  const connect = useCallback(async () => {
    leftRef.current = false
    setError(null)
    setStatus('connecting')

    // Повторный вызов (кнопка «Повторить», перезапуск эффекта) не должен
    // оставлять позади живой сокет: он продолжал бы держать место участника в
    // комнате и соперничать с новым подключением за вход.
    const previousSocket = socketRef.current
    if (previousSocket) {
      socketRef.current = null
      previousSocket.removeAllListeners()
      previousSocket.disconnect()
      closeMediaSession()
    }

    try {
      const tokenResponse = await fetch('/api/mediasoup/token', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appointmentId }),
      })
      const payload = await tokenResponse.json() as ({ success: true } & TokenData) | { success: false; error: string }
      if (!tokenResponse.ok || !payload.success) {
        throw new Error('error' in payload ? payload.error : 'Нет доступа к консультации')
      }
      tokenRef.current = payload

      const mic = await getStableMicrophone()
      micGateRef.current = mic
      const stream = new MediaStream([mic.track])
      if (!audioOnly) {
        const camera = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
        const videoTrack = camera.getVideoTracks()[0]
        if (videoTrack) stream.addTrack(videoTrack)
      }
      localStreamRef.current = stream
      setLocalStream(stream)

      const socket = io((process.env.NEXT_PUBLIC_MEDIASOUP_URL || 'http://localhost:3002').replace(/\/$/, ''), {
        path: process.env.NEXT_PUBLIC_MEDIASOUP_PATH || '/socket.io', transports: ['websocket', 'polling'], reconnection: true,
      })
      socketRef.current = socket
      socket.on('connect', () => {
        if (leftRef.current || !tokenRef.current) return
        pendingJoinRef.current = true
        void join(socket, tokenRef.current).catch((reason) => {
          setError(getCallErrorMessage(reason))
          setStatus('failed')
        })
      })
      socket.on('disconnect', () => {
        joinedSocketIdRef.current = null
        pendingJoinRef.current = true
        closeMediaSession()
        if (!leftRef.current) setStatus('reconnecting')
      })
      socket.on('connect_error', (reason) => {
        if (leftRef.current) return
        setError(INTERNET_CONNECTION_ERROR)
        setStatus('reconnecting')
      })
      socket.on('newProducer', ({ producerId, producerPeerId }) => {
        if (socket.id && joinedSocketIdRef.current === socket.id) void consume(producerId, producerPeerId)
      })
      socket.on('producerClosed', ({ producerId }) => {
        for (const [id, consumer] of consumersRef.current) if (consumer.producerId === producerId) { consumer.close(); consumersRef.current.delete(id) }
      })
      socket.on('peerMediaState', ({ micEnabled: peerMic, cameraEnabled: peerCamera }: { micEnabled: boolean; cameraEnabled: boolean }) => {
        setRemoteMicEnabled(peerMic)
        setRemoteCameraEnabled(peerCamera)
      })
      socket.on('peerJoined', () => {
        // The joining peer has default state; re-send ours so both UIs stay in sync.
        setRemoteMicEnabled(true)
        setRemoteCameraEnabled(true)
        setRemotePresence('present')
        void broadcastMediaState()
      })
      socket.on('peerLeft', ({ peerId }) => {
        remoteStreamsRef.current.delete(peerId)
        setRemoteMedia(null)
        setRemotePresence('absent')
      })
      socket.on('participantEnded', () => {
        if (leftRef.current) return
        setEndReason('participant-ended')
        cleanup()
      })
      socket.on('participantDisconnected', () => {
        if (leftRef.current) return
        setEndReason('participant-disconnected')
        cleanup()
      })
    } catch (reason) {
      setError(getCallErrorMessage(reason, 'Не удалось подключиться'))
      setStatus('failed')
    }
  }, [appointmentId, audioOnly, broadcastMediaState, cleanup, closeMediaSession, consume, join])

  const toggleMicrophone = useCallback(async () => {
    const enabled = !micEnabled
    micEnabledRef.current = enabled
    micGateRef.current?.setEnabled(enabled)
    const producer = producersRef.current.get('mic')
    if (producer && tokenRef.current && socketRef.current) {
      await emitAck(socketRef.current, enabled ? 'resumeProducer' : 'pauseProducer', { roomId: tokenRef.current.roomId, producerId: producer.id })
    }
    setMicEnabled(enabled)
    void broadcastMediaState()
  }, [broadcastMediaState, micEnabled])

  const toggleCamera = useCallback(async () => {
    if (audioOnly) return
    const producer = producersRef.current.get('camera')
    if (producer) {
      const enabled = !cameraEnabled
      cameraEnabledRef.current = enabled
      if (enabled) await producer.resume(); else await producer.pause()
      if (producer.track) producer.track.enabled = enabled
      if (tokenRef.current && socketRef.current?.connected) {
        // Pause the server-side producer too so the SFU stops forwarding frames.
        try {
          await emitAck(socketRef.current, enabled ? 'resumeProducer' : 'pauseProducer', { roomId: tokenRef.current.roomId, producerId: producer.id })
        } catch {
          // The peer still hides video through the mediaState signal below.
        }
      }
      setCameraEnabled(enabled)
      void broadcastMediaState()
    }
  }, [audioOnly, broadcastMediaState, cameraEnabled])

  useEffect(() => {
    // Пока соединения нет, показатели измерять нечем, а старые ввели бы в
    // заблуждение: сбрасываем оценку до «неизвестно».
    if (status !== 'connected') {
      qualityCountersRef.current = null
      setQuality(UNKNOWN_QUALITY)
      return
    }

    let cancelled = false
    const collect = async () => {
      const transports = [sendRef.current, recvRef.current].filter((item): item is types.Transport => item !== null)
      if (transports.length === 0) return
      try {
        const reports = await Promise.all(transports.map((transport) => transport.getStats()))
        if (cancelled) return

        const counters = readQualityCounters(reports)
        const previous = qualityCountersRef.current
        qualityCountersRef.current = counters
        // Первый снимок задаёт точку отсчёта: проценты и битрейт считаются
        // только начиная со второго.
        if (!previous) return

        const snapshot = summarizeQuality(previous, counters)
        setQuality(snapshot)
        reportQuality(snapshot)
      } catch {
        // Транспорт закрылся между снимками - на следующем тике всё повторится.
      }
    }

    void collect()
    const timer = window.setInterval(() => void collect(), QUALITY_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [reportQuality, status])

  useEffect(() => {
    const onlineHandler = () => {
      setOnline(true)
      const socket = socketRef.current
      if (!socket) return
      if (!socket.connected) {
        socket.connect()
        return
      }
      // The socket may have survived the network switch while ICE did not:
      // proactively restart ICE on both transports instead of waiting for timeouts.
      if (sendRef.current) void restartIce(sendRef.current)
      if (recvRef.current) void restartIce(recvRef.current)
    }
    const offlineHandler = () => { setOnline(false); setError(INTERNET_CONNECTION_ERROR); setStatus('reconnecting') }
    window.addEventListener('online', onlineHandler)
    window.addEventListener('offline', offlineHandler)
    return () => { window.removeEventListener('online', onlineHandler); window.removeEventListener('offline', offlineHandler); leave() }
  }, [leave, restartIce])

  return { status, error, endReason, remotePresence, quality, localStream, remoteMedia, micEnabled, cameraEnabled, remoteMicEnabled, remoteCameraEnabled, online, connect, leave, endCall, toggleMicrophone, toggleCamera }
}
