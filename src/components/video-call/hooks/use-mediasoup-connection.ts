'use client'

/**
 * MediaSoup Connection Hook
 * 
 * Replaces use-peer-connection.ts for MediaSoup SFU architecture.
 * Handles device initialization, transport creation, and producer/consumer management.
 */

import { useCallback, useRef, useState } from 'react'
import type { Device, types as mediasoupTypes } from 'mediasoup-client'
import { io, Socket } from 'socket.io-client'

type Transport = mediasoupTypes.Transport
type TransportOptions = mediasoupTypes.TransportOptions
type Producer = mediasoupTypes.Producer
type Consumer = mediasoupTypes.Consumer
type RtpCapabilities = mediasoupTypes.RtpCapabilities

export interface UseMediasoupConnectionOptions {
  peerId: string
  peerName: string
  role: 'doctor' | 'patient'
  serverUrl?: string
  onRemoteStream?: (stream: MediaStream, producerPeerId: string) => void
  onPeerJoined?: (peerId: string, peerName: string, role: string) => void
  onPeerLeft?: (peerId: string) => void
  onError?: (error: Error) => void
  onRecordingStarted?: (sessionId: string, startedBy: string) => void
  /** Called when recording stops. Server handles finalization automatically. */
  onRecordingStopped?: (
    sessionId: string, 
    filePath: string, 
    reason?: string,
    finalized?: boolean,
    recordingId?: number
  ) => void
}

export interface UseMediasoupConnectionReturn {
  isConnected: boolean
  isConnecting: boolean
  error: Error | null
  isRecording: boolean
  recordingSessionId: string | null
  // Actions
  joinRoom: (roomId: string) => Promise<boolean>
  leaveRoom: () => void
  startProducing: (stream: MediaStream) => Promise<void>
  stopProducing: () => void
  /** Start recording. Server handles storage and finalization automatically. */
  startRecording: (recordingType?: 'video' | 'audio') => Promise<boolean>
  stopRecording: () => Promise<string | null>
  cleanup: () => void
  // State
  localProducers: Map<string, Producer>
  remoteStreams: Map<string, MediaStream>
}

// Build MediaSoup server URL from env variables
function getMediasoupServerUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_MEDIASOUP_URL
  
  if (baseUrl) {
    // Remove trailing slash and return
    return baseUrl.replace(/\/$/, '')
  }
  
  // Default for local development
  return 'http://localhost:3002'
}

export function useMediasoupConnection(options: UseMediasoupConnectionOptions): UseMediasoupConnectionReturn {
  const { 
    peerId, 
    peerName, 
    role, 
    serverUrl = getMediasoupServerUrl(),
    onRemoteStream,
    onPeerJoined,
    onPeerLeft,
    onError,
    onRecordingStarted,
    onRecordingStopped,
  } = options

  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSessionId, setRecordingSessionId] = useState<string | null>(null)

  // Refs for MediaSoup objects
  const socketRef = useRef<Socket | null>(null)
  const deviceRef = useRef<Device | null>(null)
  const sendTransportRef = useRef<Transport | null>(null)
  const recvTransportRef = useRef<Transport | null>(null)
  const producersRef = useRef<Map<string, Producer>>(new Map())
  const consumersRef = useRef<Map<string, Consumer>>(new Map())
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map())
  const roomIdRef = useRef<string | null>(null)
  
  // Debounce timers for remote stream updates (prevents rapid play() calls)
  const streamUpdateTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  const [localProducers] = useState(() => new Map<string, Producer>())
  const [remoteStreams] = useState(() => new Map<string, MediaStream>())

  /**
   * Initialize mediasoup-client Device
   */
  const initDevice = useCallback(async (routerRtpCapabilities: RtpCapabilities): Promise<Device> => {
    const { Device } = await import('mediasoup-client')
    const device = new Device()
    
    await device.load({ routerRtpCapabilities })
    
    console.log('[MediaSoup Client] Device loaded')
    deviceRef.current = device
    
    return device
  }, [])

  /**
   * Create send transport for producing media
   */
  const createSendTransport = useCallback(async (socket: Socket, roomId: string, device: Device): Promise<Transport> => {
    return new Promise((resolve, reject) => {
      socket.emit('create-transport', {
        roomId,
        direction: 'send',
      }, async (response: { success: boolean; transport?: unknown; error?: string }) => {
        if (!response.success || !response.transport) {
          reject(new Error(response.error || 'Failed to create send transport'))
          return
        }

        const transportData = response.transport as {
          id: string
          iceParameters: unknown
          iceCandidates: unknown
          dtlsParameters: unknown
          sctpParameters?: unknown
        }

        const transport = device.createSendTransport({
          id: transportData.id,
          iceParameters: transportData.iceParameters as TransportOptions['iceParameters'],
          iceCandidates: transportData.iceCandidates as TransportOptions['iceCandidates'],
          dtlsParameters: transportData.dtlsParameters as TransportOptions['dtlsParameters'],
          sctpParameters: transportData.sctpParameters as TransportOptions['sctpParameters'],
        })

        transport.on('connect', ({ dtlsParameters }, callback, errback) => {
          socket.emit('connect-transport', {
            roomId,
            transportId: transport.id,
            dtlsParameters,
          }, (res: { success: boolean; error?: string }) => {
            if (res.success) {
              callback()
            } else {
              errback(new Error(res.error))
            }
          })
        })

        transport.on('produce', ({ kind, rtpParameters, appData }, callback, errback) => {
          socket.emit('produce', {
            roomId,
            transportId: transport.id,
            kind,
            rtpParameters,
            appData,
          }, (res: { success: boolean; producerId?: string; error?: string }) => {
            if (res.success && res.producerId) {
              callback({ id: res.producerId })
            } else {
              errback(new Error(res.error))
            }
          })
        })
        
        // ICE connection state monitoring
        transport.on('connectionstatechange', (state) => {
          console.log('[MediaSoup Client] Send transport connection state:', state)
          if (state === 'failed') {
            console.error('[MediaSoup Client] Send transport ICE connection FAILED - check TURN server and firewall')
          }
        })

        console.log('[MediaSoup Client] Send transport created:', transport.id)
        console.log('[MediaSoup Client] ICE candidates received:', JSON.stringify(transportData.iceCandidates))
        resolve(transport)
      })
    })
  }, [])

  /**
   * Create receive transport for consuming media
   */
  const createRecvTransport = useCallback(async (socket: Socket, roomId: string, device: Device): Promise<Transport> => {
    return new Promise((resolve, reject) => {
      socket.emit('create-transport', {
        roomId,
        direction: 'recv',
      }, async (response: { success: boolean; transport?: unknown; error?: string }) => {
        if (!response.success || !response.transport) {
          reject(new Error(response.error || 'Failed to create recv transport'))
          return
        }

        const transportData = response.transport as {
          id: string
          iceParameters: unknown
          iceCandidates: unknown
          dtlsParameters: unknown
          sctpParameters?: unknown
        }

        const transport = device.createRecvTransport({
          id: transportData.id,
          iceParameters: transportData.iceParameters as TransportOptions['iceParameters'],
          iceCandidates: transportData.iceCandidates as TransportOptions['iceCandidates'],
          dtlsParameters: transportData.dtlsParameters as TransportOptions['dtlsParameters'],
          sctpParameters: transportData.sctpParameters as TransportOptions['sctpParameters'],
        })

        transport.on('connect', ({ dtlsParameters }, callback, errback) => {
          socket.emit('connect-transport', {
            roomId,
            transportId: transport.id,
            dtlsParameters,
          }, (res: { success: boolean; error?: string }) => {
            if (res.success) {
              callback()
            } else {
              errback(new Error(res.error))
            }
          })
        })
        
        // ICE connection state monitoring
        transport.on('connectionstatechange', (state) => {
          console.log('[MediaSoup Client] Recv transport connection state:', state)
          if (state === 'failed') {
            console.error('[MediaSoup Client] Recv transport ICE connection FAILED - check TURN server and firewall')
          }
        })

        console.log('[MediaSoup Client] Recv transport created:', transport.id)
        console.log('[MediaSoup Client] Recv ICE candidates:', JSON.stringify(transportData.iceCandidates))
        resolve(transport)
      })
    })
  }, [])

  /**
   * Consume a remote producer
   */
  const consumeProducer = useCallback(async (
    socket: Socket, 
    roomId: string, 
    producerId: string, 
    producerPeerId: string,
    kind: 'audio' | 'video'
  ) => {
    const device = deviceRef.current
    const recvTransport = recvTransportRef.current

    if (!device || !recvTransport) {
      console.error('[MediaSoup Client] Device or recv transport not ready')
      return
    }

    return new Promise<void>((resolve, reject) => {
      socket.emit('consume', {
        roomId,
        producerId,
        producerPeerId,
      }, async (response: {
        success: boolean
        consumer?: {
          id: string
          producerId: string
          kind: 'audio' | 'video'
          rtpParameters: unknown
          producerPaused: boolean
        }
        error?: string
      }) => {
        if (!response.success || !response.consumer) {
          reject(new Error(response.error || 'Failed to consume'))
          return
        }

        try {
          const consumer = await recvTransport.consume({
            id: response.consumer.id,
            producerId: response.consumer.producerId,
            kind: response.consumer.kind,
            rtpParameters: response.consumer.rtpParameters as mediasoupTypes.RtpParameters,
          })

          consumersRef.current.set(consumer.id, consumer)

          // Resume consumer on server
          socket.emit('resume-consumer', {
            roomId,
            consumerId: consumer.id,
          }, () => {})

          // Get existing stream or create new one
          const existingStream = remoteStreamsRef.current.get(producerPeerId)
          
          // Create a new MediaStream with existing tracks + new track
          // This ensures React sees the change (new object reference)
          const newStream = new MediaStream()
          
          // Add existing tracks from old stream (avoid duplicates by checking track kind)
          if (existingStream) {
            existingStream.getTracks().forEach((track) => {
              // Only add tracks of different kind than the new one
              // This prevents duplicates when we receive audio then video
              if (track.kind !== kind) {
                newStream.addTrack(track)
              }
            })
          }
          
          // Add the new track (this is always the latest for this kind)
          newStream.addTrack(consumer.track)
          
          // Update refs and state
          remoteStreamsRef.current.set(producerPeerId, newStream)
          remoteStreams.set(producerPeerId, newStream)

          console.log(`[MediaSoup Client] Consuming ${kind} from peer ${producerPeerId}`)
          console.log(`[MediaSoup Client] Stream now has audio: ${newStream.getAudioTracks().length}, video: ${newStream.getVideoTracks().length}`)

          // Debounce the onRemoteStream callback to prevent rapid play() calls
          // When audio and video arrive in quick succession, we wait for both
          // before notifying React, avoiding AbortError on play()
          const existingTimer = streamUpdateTimersRef.current.get(producerPeerId)
          if (existingTimer) {
            clearTimeout(existingTimer)
          }
          
          const timer = setTimeout(() => {
            streamUpdateTimersRef.current.delete(producerPeerId)
            const latestStream = remoteStreamsRef.current.get(producerPeerId)
            if (latestStream) {
              console.log(`[MediaSoup Client] Notifying remote stream (debounced): audio=${latestStream.getAudioTracks().length}, video=${latestStream.getVideoTracks().length}`)
              onRemoteStream?.(latestStream, producerPeerId)
            }
          }, 150) // Wait 150ms for additional tracks before notifying
          
          streamUpdateTimersRef.current.set(producerPeerId, timer)

          resolve()
        } catch (err) {
          reject(err)
        }
      })
    })
  }, [onRemoteStream, remoteStreams])

  /**
   * Join a room (appointment)
   */
  const joinRoom = useCallback(async (roomId: string): Promise<boolean> => {
    if (isConnecting || isConnected) {
      console.log('[MediaSoup Client] Already connected or connecting')
      return isConnected
    }

    setIsConnecting(true)
    setError(null)

    try {
      // Connect to MediaSoup server via basePath + /mediasoup path (nginx proxies to port 3002)
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''
      const socketPath = `${basePath}/mediasoup`
      console.log('[MediaSoup Client] Connecting to:', serverUrl, 'path:', socketPath)
      const socket = io(serverUrl, {
        path: socketPath,
        transports: ['websocket', 'polling'],
      })

      socketRef.current = socket

      await new Promise<void>((resolve, reject) => {
        socket.on('connect', () => {
          console.log('[MediaSoup Client] Socket connected')
          resolve()
        })
        socket.on('connect_error', (err) => {
          reject(err)
        })
        setTimeout(() => reject(new Error('Connection timeout')), 10000)
      })

      // Join room
      const joinResponse = await new Promise<{
        success: boolean
        routerRtpCapabilities?: RtpCapabilities
        error?: string
      }>((resolve) => {
        socket.emit('join-room', {
          roomId,
          peerId,
          peerName,
          role,
        }, resolve)
      })

      if (!joinResponse.success || !joinResponse.routerRtpCapabilities) {
        throw new Error(joinResponse.error || 'Failed to join room')
      }

      roomIdRef.current = roomId

      // Initialize device
      const device = await initDevice(joinResponse.routerRtpCapabilities)

      // Send RTP capabilities to server
      socket.emit('set-rtp-capabilities', {
        rtpCapabilities: device.rtpCapabilities,
      })

      // Create transports
      const [sendTransport, recvTransport] = await Promise.all([
        createSendTransport(socket, roomId, device),
        createRecvTransport(socket, roomId, device),
      ])

      sendTransportRef.current = sendTransport
      recvTransportRef.current = recvTransport

      // Set up event listeners
      socket.on('peer-joined', (data: { peerId: string; peerName: string; role: string }) => {
        console.log('[MediaSoup Client] Peer joined:', data)
        onPeerJoined?.(data.peerId, data.peerName, data.role)
      })

      socket.on('peer-left', (data: { peerId: string }) => {
        console.log('[MediaSoup Client] Peer left:', data)
        
        // Clean up remote stream
        const stream = remoteStreamsRef.current.get(data.peerId)
        if (stream) {
          stream.getTracks().forEach((track) => track.stop())
          remoteStreamsRef.current.delete(data.peerId)
          remoteStreams.delete(data.peerId)
        }
        
        onPeerLeft?.(data.peerId)
      })

      socket.on('new-producer', async (data: {
        producerId: string
        producerPeerId: string
        kind: 'audio' | 'video'
      }) => {
        console.log('[MediaSoup Client] New producer:', data)
        await consumeProducer(socket, roomId, data.producerId, data.producerPeerId, data.kind)
      })

      // Recording events
      socket.on('recording-started', (data: { sessionId: string; startedBy: string }) => {
        console.log('[MediaSoup Client] Recording started:', data)
        setIsRecording(true)
        setRecordingSessionId(data.sessionId)
        onRecordingStarted?.(data.sessionId, data.startedBy)
      })

      socket.on('recording-stopped', (data: { 
        sessionId: string
        filePath: string
        reason?: string
        finalized?: boolean
        recordingId?: number
        error?: string
      }) => {
        console.log('[MediaSoup Client] Recording stopped:', data)
        setIsRecording(false)
        setRecordingSessionId(null)
        onRecordingStopped?.(data.sessionId, data.filePath, data.reason, data.finalized, data.recordingId)
      })

      // Check if there's an active recording when joining
      socket.emit('get-recording-status', { roomId }, (response: {
        success: boolean
        isRecording: boolean
        sessionId?: string
      }) => {
        if (response.success && response.isRecording && response.sessionId) {
          setIsRecording(true)
          setRecordingSessionId(response.sessionId)
        }
      })

      // Get existing producers
      socket.emit('get-producers', { roomId }, async (response: {
        success: boolean
        producers?: Array<{
          producerId: string
          producerPeerId: string
          kind: 'audio' | 'video'
        }>
      }) => {
        if (response.success && response.producers) {
          for (const producer of response.producers) {
            await consumeProducer(socket, roomId, producer.producerId, producer.producerPeerId, producer.kind)
          }
        }
      })

      setIsConnected(true)
      setIsConnecting(false)
      console.log('[MediaSoup Client] Joined room:', roomId)

      return true

    } catch (err) {
      console.error('[MediaSoup Client] Join room error:', err)
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      setIsConnecting(false)
      onError?.(error)
      return false
    }
  }, [isConnecting, isConnected, serverUrl, peerId, peerName, role, initDevice, createSendTransport, createRecvTransport, consumeProducer, onPeerJoined, onPeerLeft, onError, remoteStreams])

  /**
   * Start producing (send local media)
   */
  const startProducing = useCallback(async (stream: MediaStream): Promise<void> => {
    const sendTransport = sendTransportRef.current

    if (!sendTransport) {
      throw new Error('Send transport not ready')
    }

    // Produce video track
    const videoTrack = stream.getVideoTracks()[0]
    if (videoTrack) {
      const videoProducer = await sendTransport.produce({
        track: videoTrack,
        encodings: [
          { maxBitrate: 100000 },
          { maxBitrate: 300000 },
          { maxBitrate: 900000 },
        ],
        codecOptions: {
          videoGoogleStartBitrate: 1000,
        },
      })
      producersRef.current.set('video', videoProducer)
      localProducers.set('video', videoProducer)
      console.log('[MediaSoup Client] Video producer created:', videoProducer.id)
    }

    // Produce audio track
    const audioTrack = stream.getAudioTracks()[0]
    if (audioTrack) {
      const audioProducer = await sendTransport.produce({
        track: audioTrack,
      })
      producersRef.current.set('audio', audioProducer)
      localProducers.set('audio', audioProducer)
      console.log('[MediaSoup Client] Audio producer created:', audioProducer.id)
    }
  }, [localProducers])

  /**
   * Stop producing
   */
  const stopProducing = useCallback(() => {
    for (const producer of producersRef.current.values()) {
      producer.close()
    }
    producersRef.current.clear()
    localProducers.clear()
    console.log('[MediaSoup Client] Stopped producing')
  }, [localProducers])

  /**
   * Start recording (only doctors can do this)
   * @param recordingType - 'video' or 'audio' (default: 'video')
   */
  const startRecording = useCallback(async (recordingType: 'video' | 'audio' = 'video'): Promise<boolean> => {
    const socket = socketRef.current
    const roomId = roomIdRef.current

    if (!socket || !roomId) {
      console.error('[MediaSoup Client] Cannot start recording: not connected')
      return false
    }

    if (role !== 'doctor') {
      console.error('[MediaSoup Client] Only doctors can start recording')
      return false
    }

    return new Promise((resolve) => {
      socket.emit('start-recording', { roomId, recordingType }, (response: {
        success: boolean
        sessionId?: string
        error?: string
      }) => {
        if (response.success && response.sessionId) {
          console.log('[MediaSoup Client] Recording started, session:', response.sessionId)
          setIsRecording(true)
          setRecordingSessionId(response.sessionId)
          resolve(true)
        } else {
          console.error('[MediaSoup Client] Failed to start recording:', response.error)
          resolve(false)
        }
      })
    })
  }, [role])

  /**
   * Stop recording (only doctors can do this)
   */
  const stopRecording = useCallback(async (): Promise<string | null> => {
    const socket = socketRef.current
    const roomId = roomIdRef.current

    if (!socket || !roomId) {
      console.error('[MediaSoup Client] Cannot stop recording: not connected')
      return null
    }

    if (role !== 'doctor') {
      console.error('[MediaSoup Client] Only doctors can stop recording')
      return null
    }

    return new Promise((resolve) => {
      socket.emit('stop-recording', { roomId }, (response: {
        success: boolean
        filePath?: string
        error?: string
      }) => {
        if (response.success) {
          console.log('[MediaSoup Client] Recording stopped, file:', response.filePath)
          setIsRecording(false)
          setRecordingSessionId(null)
          resolve(response.filePath || null)
        } else {
          console.error('[MediaSoup Client] Failed to stop recording:', response.error)
          resolve(null)
        }
      })
    })
  }, [role])

  /**
   * Leave room
   */
  const leaveRoom = useCallback(() => {
    const socket = socketRef.current
    const roomId = roomIdRef.current

    if (socket && roomId) {
      socket.emit('leave-room', { roomId })
    }

    // Close transports
    sendTransportRef.current?.close()
    recvTransportRef.current?.close()
    sendTransportRef.current = null
    recvTransportRef.current = null

    // Clear producers and consumers
    producersRef.current.clear()
    consumersRef.current.clear()
    localProducers.clear()
    
    // Clear remote streams
    for (const stream of remoteStreamsRef.current.values()) {
      stream.getTracks().forEach((track) => track.stop())
    }
    remoteStreamsRef.current.clear()
    remoteStreams.clear()
    
    // Clear stream update debounce timers
    for (const timer of streamUpdateTimersRef.current.values()) {
      clearTimeout(timer)
    }
    streamUpdateTimersRef.current.clear()

    roomIdRef.current = null
    setIsConnected(false)

    console.log('[MediaSoup Client] Left room')
  }, [localProducers, remoteStreams])

  /**
   * Cleanup everything
   */
  const cleanup = useCallback(() => {
    leaveRoom()
    
    // Disconnect socket
    socketRef.current?.disconnect()
    socketRef.current = null
    
    // Clear device
    deviceRef.current = null
    
    setError(null)
    
    console.log('[MediaSoup Client] Cleaned up')
  }, [leaveRoom])

  return {
    isConnected,
    isConnecting,
    error,
    isRecording,
    recordingSessionId,
    joinRoom,
    leaveRoom,
    startProducing,
    stopProducing,
    startRecording,
    stopRecording,
    cleanup,
    localProducers,
    remoteStreams,
  }
}
