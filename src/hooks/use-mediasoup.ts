'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Device, types } from 'mediasoup-client'
import { io, type Socket } from 'socket.io-client'
import { getStableMicrophone, type MicrophoneGate } from '@/lib/mediasoup/mic-gate'

type Status = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed'
type Ack<T = Record<string, never>> = ({ success: true } & T) | { success: false; error: string }
interface TokenData { token: string; roomId: string; peerId: string; role: 'doctor' | 'patient'; peerName: string }
interface RemoteMedia { peerId: string; stream: MediaStream }

const ackTimeout = 10_000

function emitAck<T>(socket: Socket, event: string, data: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`${event}: timeout`)), ackTimeout)
    socket.emit(event, data, (response: Ack<T>) => {
      window.clearTimeout(timer)
      if (!response?.success) reject(new Error(response?.error || `${event}: failed`))
      else resolve(response as T)
    })
  })
}

export function useMediasoup(appointmentId: number, audioOnly = false) {
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteMedia, setRemoteMedia] = useState<RemoteMedia | null>(null)
  const [micEnabled, setMicEnabled] = useState(true)
  const [cameraEnabled, setCameraEnabled] = useState(!audioOnly)
  const [screenSharing, setScreenSharing] = useState(false)
  const [online, setOnline] = useState(true)

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
  const rebuildingRef = useRef(false)
  const leftRef = useRef(false)

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
    if (!socket || !token || !device || !recv || [...consumersRef.current.values()].some((item) => item.producerId === producerId)) return

    const response = await emitAck<{ consumer: { id: string; producerId: string; kind: types.MediaKind; rtpParameters: types.RtpParameters } }>(socket, 'consume', {
      roomId: token.roomId,
      producerId,
      producerPeerId,
      rtpCapabilities: device.rtpCapabilities,
    })
    const consumer = await recv.consume(response.consumer)
    consumersRef.current.set(consumer.id, consumer)
    const previous = remoteStreamsRef.current.get(producerPeerId)
    const stream = new MediaStream(previous?.getTracks().filter((track) => track.kind !== consumer.kind) ?? [])
    stream.addTrack(consumer.track)
    remoteStreamsRef.current.set(producerPeerId, stream)
    setRemoteMedia({ peerId: producerPeerId, stream })
    consumer.on('transportclose', () => consumersRef.current.delete(consumer.id))
    consumer.on('trackended', () => consumersRef.current.delete(consumer.id))
    await emitAck(socket, 'resumeConsumer', { roomId: token.roomId, consumerId: consumer.id })
  }, [])

  const createTransports = useCallback(async (socket: Socket, token: TokenData, device: Device) => {
    const sendData = await emitAck<{ transport: types.TransportOptions }>(socket, 'createWebRtcTransport', { roomId: token.roomId, direction: 'send' })
    const recvData = await emitAck<{ transport: types.TransportOptions }>(socket, 'createWebRtcTransport', { roomId: token.roomId, direction: 'recv' })
    const send = device.createSendTransport(sendData.transport)
    const recv = device.createRecvTransport(recvData.transport)

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

  const publishLocalTracks = useCallback(async () => {
    const send = sendRef.current
    const stream = localStreamRef.current
    if (!send || !stream) return
    for (const track of stream.getTracks()) {
      const key = track.kind === 'audio' ? 'mic' : 'camera'
      if (producersRef.current.has(key)) continue
      const producer = await send.produce({ track, appData: { source: key } })
      producersRef.current.set(key, producer)
    }
  }, [])

  const join = useCallback(async (socket: Socket, token: TokenData) => {
    if (rebuildingRef.current) return
    rebuildingRef.current = true
    try {
      setStatus(status === 'idle' ? 'connecting' : 'reconnecting')
      for (const consumer of consumersRef.current.values()) consumer.close()
      for (const producer of producersRef.current.values()) producer.close()
      consumersRef.current.clear()
      producersRef.current.clear()
      sendRef.current?.close()
      recvRef.current?.close()

      const joined = await emitAck<{ routerRtpCapabilities: types.RtpCapabilities }>(socket, 'joinRoom', token)
      const { Device } = await import('mediasoup-client')
      const device = new Device()
      await device.load({ routerRtpCapabilities: joined.routerRtpCapabilities })
      deviceRef.current = device
      await createTransports(socket, token, device)
      await publishLocalTracks()
      const existing = await emitAck<{ producers: Array<{ producerId: string; producerPeerId: string }> }>(socket, 'getProducers', { roomId: token.roomId })
      await Promise.all(existing.producers.map((producer) => consume(producer.producerId, producer.producerPeerId)))
      setStatus('connected')
    } finally {
      rebuildingRef.current = false
    }
  }, [consume, createTransports, publishLocalTracks, status])

  const leave = useCallback(() => {
    leftRef.current = true
    const socket = socketRef.current
    const token = tokenRef.current
    if (socket && token) socket.emit('leaveRoom', { roomId: token.roomId }, () => undefined)
    socket?.disconnect()
    for (const consumer of consumersRef.current.values()) consumer.close()
    for (const producer of producersRef.current.values()) producer.close()
    consumersRef.current.clear()
    producersRef.current.clear()
    sendRef.current?.close()
    recvRef.current?.close()
    micGateRef.current?.close()
    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    setStatus('idle')
  }, [])

  const connect = useCallback(async () => {
    leftRef.current = false
    setError(null)
    setStatus('connecting')
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
      socket.on('connect', () => { if (!leftRef.current && tokenRef.current) void join(socket, tokenRef.current).catch((reason) => setError(reason instanceof Error ? reason.message : 'Ошибка подключения')) })
      socket.on('disconnect', () => { if (!leftRef.current) setStatus('reconnecting') })
      socket.on('newProducer', ({ producerId, producerPeerId }) => void consume(producerId, producerPeerId))
      socket.on('producerClosed', ({ producerId }) => {
        for (const [id, consumer] of consumersRef.current) if (consumer.producerId === producerId) { consumer.close(); consumersRef.current.delete(id) }
      })
      socket.on('peerLeft', ({ peerId }) => { remoteStreamsRef.current.delete(peerId); setRemoteMedia(null) })
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Не удалось подключиться'
      setError(message)
      setStatus('failed')
    }
  }, [appointmentId, audioOnly, consume, join])

  const toggleMicrophone = useCallback(async () => {
    const enabled = !micEnabled
    micGateRef.current?.setEnabled(enabled)
    const producer = producersRef.current.get('mic')
    if (producer && tokenRef.current && socketRef.current) {
      await emitAck(socketRef.current, enabled ? 'resumeProducer' : 'pauseProducer', { roomId: tokenRef.current.roomId, producerId: producer.id })
    }
    setMicEnabled(enabled)
  }, [micEnabled])

  const toggleCamera = useCallback(async () => {
    const producer = producersRef.current.get('camera')
    if (producer) {
      const enabled = !cameraEnabled
      if (enabled) await producer.resume(); else await producer.pause()
      if (producer.track) producer.track.enabled = enabled
      setCameraEnabled(enabled)
    }
  }, [cameraEnabled])

  const toggleScreen = useCallback(async () => {
    const send = sendRef.current
    if (!send) return
    const current = producersRef.current.get('screen')
    if (current) { current.close(); producersRef.current.delete('screen'); setScreenSharing(false); return }
    const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
    const track = display.getVideoTracks()[0]
    if (!track) return
    const producer = await send.produce({ track, appData: { source: 'screen' } })
    producersRef.current.set('screen', producer)
    setScreenSharing(true)
    track.addEventListener('ended', () => { producer.close(); producersRef.current.delete('screen'); setScreenSharing(false) }, { once: true })
  }, [])

  useEffect(() => {
    const onlineHandler = () => { setOnline(true); if (socketRef.current && !socketRef.current.connected) socketRef.current.connect() }
    const offlineHandler = () => { setOnline(false); setStatus('reconnecting') }
    window.addEventListener('online', onlineHandler)
    window.addEventListener('offline', offlineHandler)
    return () => { window.removeEventListener('online', onlineHandler); window.removeEventListener('offline', offlineHandler); leave() }
  }, [leave])

  return { status, error, localStream, remoteMedia, micEnabled, cameraEnabled, screenSharing, online, connect, leave, toggleMicrophone, toggleCamera, toggleScreen }
}
