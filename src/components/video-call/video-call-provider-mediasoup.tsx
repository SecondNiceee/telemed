'use client'

/**
 * VideoCallProvider с поддержкой MediaSoup SFU
 * 
 * Заменяет PeerJS провайдер для серверной записи консультаций.
 * Медиа проходит через MediaSoup сервер, что позволяет:
 * - Записывать на сервере (не зависит от клиента)
 * - Гарантировать сохранение записи при обрыве соединения
 * - Контролировать качество записи
 */

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
  type ReactNode,
} from 'react'
import { toast } from 'sonner'
import { useSocket } from '@/components/socket-provider'
import { useCallStore } from '@/stores/call-store'
import { useUserStore } from '@/stores/user-store'
import { useDoctorStore } from '@/stores/doctor-store'
import { useMediaStream } from './hooks/use-media-stream'
import { useCallTimer } from './hooks/use-call-timer'
import { useConnectionQuality } from './hooks/use-connection-quality'
import { useMediasoupConnection } from './hooks/use-mediasoup-connection'
import { CALL_TIMEOUTS } from '@/lib/video-call/config'
import type {
  CallStatus,
  CallViewMode,
  CallParticipant,
  CallRole,
  MediaState,
} from '@/lib/video-call/types'

// Extended context value for MediaSoup
interface MediaSoupVideoCallContextValue {
  // State
  status: CallStatus
  callData: {
    appointmentId: number
    caller: CallParticipant
    callee: CallParticipant
    durationMinutes: number
  } | null
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  mediaState: MediaState
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown'
  viewMode: CallViewMode
  remainingSeconds: number
  isPaused: boolean
  isSavingRecording: boolean
  isAudioOnly: boolean
  
  // MediaSoup-specific state
  isServerRecording: boolean
  recordingSessionId: string | null
  
  // Actions
  startCall: (callee: CallParticipant, appointmentId: number, durationMinutes: number) => Promise<void>
  startAudioCall: (callee: CallParticipant, appointmentId: number, durationMinutes: number) => Promise<void>
  answerCall: () => Promise<void>
  rejectCall: () => void
  endCall: () => void
  toggleVideo: () => void
  toggleAudio: () => void
  toggleMinimize: () => void
  togglePause: () => void
  completeConsultation: () => void
  
  // MediaSoup-specific actions
  /** Start recording. Server handles storage and finalization automatically. */
  startServerRecording: (recordingType?: 'video' | 'audio') => Promise<boolean>
  stopServerRecording: () => Promise<string | null>
  
  // Info
  currentUser: CallParticipant | null
  role: CallRole | null
}

const VideoCallContext = createContext<MediaSoupVideoCallContextValue | null>(null)

interface VideoCallProviderMediaSoupProps {
  children: ReactNode
}

export function VideoCallProviderMediaSoup({ children }: VideoCallProviderMediaSoupProps) {
  // Get current user from stores
  const user = useUserStore((state) => state.user)
  const doctor = useDoctorStore((state) => state.doctor)
  
  // Generate unique tab ID
  const tabIdRef = useRef<string>('')
  if (typeof window !== 'undefined' && !tabIdRef.current) {
    tabIdRef.current = `_${Date.now().toString(36)}`
  }
  
  // Derive currentUser from available data
  const currentUser = useMemo<CallParticipant | null>(() => {
    const tabSuffix = tabIdRef.current
    if (doctor) {
      const odooUserId = doctor.id
      const peerId = `doctor_${odooUserId}${tabSuffix}`
      return {
        odooUserId,
        odooPartnerId: odooUserId,
        odooPartnerName: doctor.name || 'Doctor',
        peerId,
        basePeerId: `doctor_${odooUserId}`,
        role: 'doctor' as const,
      }
    }
    if (user) {
      const odooUserId = user.id
      const peerId = `patient_${odooUserId}${tabSuffix}`
      return {
        odooUserId,
        odooPartnerId: odooUserId,
        odooPartnerName: user.name || 'User',
        peerId,
        basePeerId: `patient_${odooUserId}`,
        role: 'patient' as const,
      }
    }
    return null
  }, [doctor, user])
  
  // Zustand store
  const callStore = useCallStore()
  
  // Socket for signaling
  const socket = useSocket()
  
  // Local state
  const [status, setStatus] = useState<CallStatus>('idle')
  const statusRef = useRef<CallStatus>('idle')
  const [isAudioOnly, setIsAudioOnly] = useState(false)
  const [viewMode, setViewMode] = useState<CallViewMode>('fullscreen')
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [callData, setCallData] = useState<{
    appointmentId: number
    durationMinutes: number
    participant: CallParticipant
    isOutgoing: boolean
  } | null>(null)
  const callDataRef = useRef(callData)
  const callTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const recordingStartTimeRef = useRef<number | null>(null)
  const isAudioOnlyRef = useRef(false)
  
  // Keep refs in sync
  useEffect(() => {
    statusRef.current = status
  }, [status])
  useEffect(() => {
    callDataRef.current = callData
  }, [callData])
  useEffect(() => {
    isAudioOnlyRef.current = isAudioOnly
  }, [isAudioOnly])
  
  // Hooks
  const mediaStream = useMediaStream()
  const timer = useCallTimer(0)
  const connectionQuality = useConnectionQuality()
  
  // MediaSoup connection
  const mediasoup = useMediasoupConnection({
    peerId: currentUser?.peerId || '',
    peerName: currentUser?.odooPartnerName || '',
    role: currentUser?.role || 'patient',
    onRemoteStream: (stream, producerPeerId) => {
      console.log('[MediaSoup Provider] Remote stream received from:', producerPeerId)
      setRemoteStream(stream)
      
      // If we were connecting, we're now connected
      if (statusRef.current === 'connecting') {
        setStatus('connected')
        timer.start()
      }
    },
  onPeerJoined: (peerId, peerName, role) => {
      console.log('[MediaSoup Provider] Peer joined:', peerId, peerName, role, 'current status:', statusRef.current)
      // Only show toast and consider it a real join when we're already connected or connecting
      // Don't change status here - wait for 'call-answered' event from socket
      // The peer might have joined the MediaSoup room but hasn't answered the call yet
      if (statusRef.current === 'connected' || statusRef.current === 'connecting') {
        toast.info(`${peerName} присоединился к звонку`)
      }
    },
    onPeerLeft: (peerId) => {
      console.log('[MediaSoup Provider] Peer left:', peerId)
      // If the other participant left, end the call
      if (statusRef.current === 'connected' || statusRef.current === 'connecting') {
        toast.info('Собеседник покинул звонок')
        handleCallEnded()
      }
    },
    onError: (error) => {
      console.error('[MediaSoup Provider] Error:', error)
      toast.error(`Ошибка соединения: ${error.message}`)
    },
    onRecordingStarted: (sessionId, startedBy) => {
      console.log('[MediaSoup Provider] Recording started:', sessionId, 'by', startedBy)
      recordingStartTimeRef.current = Date.now()
      toast.success('Запись консультации начата')
    },
    onRecordingStopped: (sessionId, filePath, reason, finalized, recordingId) => {
      console.log('[MediaSoup Provider] Recording stopped:', { sessionId, filePath, reason, finalized, recordingId })
      
      // Server handles finalization automatically now
      // We just need to show the appropriate toast based on the result
      if (finalized && recordingId) {
        toast.success('Запись консультации сохранена')
      } else if (reason === 'doctor-disconnected') {
        toast.info('Запись остановлена (врач отключился)')
      } else if (finalized === false) {
        toast.error('Не удалось сохранить запись')
      } else {
        // Recording stopped but we don't know if it was finalized
        toast.info('Запись консультации остановлена')
      }
      
      recordingStartTimeRef.current = null
    },
  })
  
  // Peer ID
  const peerId = currentUser?.peerId ?? null
  
  // Media state
  const mediaState: MediaState = {
    isVideoEnabled: mediaStream.isVideoEnabled,
    isAudioEnabled: mediaStream.isAudioEnabled,
    isCameraAvailable: mediaStream.isCameraAvailable,
    isMicrophoneAvailable: mediaStream.isMicrophoneAvailable,
  }
  
  // Role
  const role: CallRole | null = currentUser?.role ?? null
  
  // Clear call timeout
  const clearCallTimeout = useCallback(() => {
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current)
      callTimeoutRef.current = null
    }
  }, [])
  
  // Handle call ended
  const handleCallEnded = useCallback(async () => {
    console.log('[MediaSoup Provider] handleCallEnded')
    
    clearCallTimeout()
    connectionQuality.stopMonitoring()
    timer.pause()
    
    // If doctor is ending the call and recording is active, stop it first
    // This will trigger onRecordingStopped which will finalize the recording
    if (currentUser?.role === 'doctor' && mediasoup.isRecording) {
      console.log('[MediaSoup Provider] Doctor ending call, stopping recording first...')
      await mediasoup.stopRecording()
      // Give a moment for the recording-stopped event to be processed
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    // Stop MediaSoup connection
    mediasoup.leaveRoom()
    
    // Stop local media
    mediaStream.stopStream()
    
    setRemoteStream(null)
    setStatus('ended')
    setCallData(null)
    callStore.endCall()
    
    // Reset to idle after animation
    setTimeout(() => {
      setStatus('idle')
      setViewMode('fullscreen')
      setIsAudioOnly(false)
    }, 1000)
  }, [clearCallTimeout, connectionQuality, timer, mediasoup, mediaStream, callStore, currentUser])
  
  // Start outgoing video call
  const startCall = useCallback(async (
    callee: CallParticipant,
    appointmentId: number,
    durationMinutes: number
  ) => {
    if (!currentUser || !peerId) {
      toast.error('Не удалось начать звонок')
      return
    }
    
    setIsAudioOnly(false)
    setStatus('calling')
    setCallData({
      appointmentId,
      durationMinutes,
      participant: callee,
      isOutgoing: true,
    })
    timer.reset(durationMinutes)
    
    // Get media stream
    const stream = await mediaStream.getStream(true, true)
    if (!stream) {
      toast.error('Нет доступа к камере/микрофону')
      setStatus('idle')
      setCallData(null)
      return
    }
    
    callStore.setLocalStream(stream)
    
    // Join MediaSoup room (using appointmentId as roomId)
    const roomId = `appointment_${appointmentId}`
    const joined = await mediasoup.joinRoom(roomId)
    
    if (!joined) {
      toast.error('Не удалось подключиться к серверу')
      setStatus('idle')
      setCallData(null)
      mediaStream.stopStream()
      return
    }
    
    // Start producing media
    await mediasoup.startProducing(stream)
    
    // Signal call via socket (for notification)
    socket.initiateCall(appointmentId, peerId, currentUser.odooPartnerName)
    callStore.startCall(appointmentId, callee.peerId)
    
    // Stay in 'calling' status until the remote peer answers
    // Status will change to 'connecting' when we receive 'call-answered' event
    // and then to 'connected' when remote stream is received
    
    // Set call timeout
    callTimeoutRef.current = setTimeout(() => {
      if (statusRef.current === 'calling' || statusRef.current === 'connecting') {
        toast.error('Нет ответа')
        handleCallEnded()
      }
    }, CALL_TIMEOUTS.CALL_TIMEOUT)
    
    // Auto-start recording for doctors (video call)
    if (currentUser.role === 'doctor') {
      // Wait a bit for the other participant to join
      setTimeout(async () => {
        if (statusRef.current === 'connected') {
          const started = await mediasoup.startRecording('video')
          if (started) {
            console.log('[MediaSoup Provider] Auto-started video recording for doctor')
          }
        }
      }, 3000)
    }
    
  }, [currentUser, peerId, mediaStream, mediasoup, socket, callStore, timer, handleCallEnded])
  
  // Start outgoing audio-only call
  const startAudioCall = useCallback(async (
    callee: CallParticipant,
    appointmentId: number,
    durationMinutes: number
  ) => {
    if (!currentUser || !peerId) {
      toast.error('Не удалось начать звонок')
      return
    }
    
    setIsAudioOnly(true)
    setStatus('calling')
    setCallData({
      appointmentId,
      durationMinutes,
      participant: callee,
      isOutgoing: true,
    })
    timer.reset(durationMinutes)
    
    // Get media stream (audio only)
    const stream = await mediaStream.getStream(false, true)
    if (!stream) {
      toast.error('Нет доступа к микрофону')
      setStatus('idle')
      setCallData(null)
      setIsAudioOnly(false)
      return
    }
    
    callStore.setLocalStream(stream)
    
    // Join MediaSoup room
    const roomId = `appointment_${appointmentId}`
    const joined = await mediasoup.joinRoom(roomId)
    
    if (!joined) {
      toast.error('Не удалось подключиться к серверу')
      setStatus('idle')
      setCallData(null)
      setIsAudioOnly(false)
      mediaStream.stopStream()
      return
    }
    
    // Start producing media
    await mediasoup.startProducing(stream)
    
    // Signal call via socket
    socket.initiateCall(appointmentId, peerId, currentUser.odooPartnerName, true) // true for audio only
    callStore.startCall(appointmentId, callee.peerId)
    
    // Stay in 'calling' status until the remote peer answers
    // Status will change to 'connecting' when we receive 'call-answered' event
    
    // Set call timeout
    callTimeoutRef.current = setTimeout(() => {
      if (statusRef.current === 'calling' || statusRef.current === 'connecting') {
        toast.error('Нет ответа')
        handleCallEnded()
      }
    }, CALL_TIMEOUTS.CALL_TIMEOUT)
    
    // Auto-start recording for doctors (audio call)
    if (currentUser.role === 'doctor') {
      setTimeout(async () => {
        if (statusRef.current === 'connected') {
          const started = await mediasoup.startRecording('audio')
          if (started) {
            console.log('[MediaSoup Provider] Auto-started audio recording for doctor')
          }
        }
      }, 3000)
    }
    
  }, [currentUser, peerId, mediaStream, mediasoup, socket, callStore, timer, handleCallEnded])
  
  // Answer incoming call
  const answerCall = useCallback(async () => {
    if (!callData || !peerId || !currentUser) return
    
    console.log('[MediaSoup Provider] Answering call, isAudioOnly:', isAudioOnly)
    setStatus('connecting')
    
    // Get media stream
    const useVideo = !isAudioOnly
    console.log('[MediaSoup Provider] Requesting media stream, useVideo:', useVideo)
    const stream = await mediaStream.getStream(useVideo, true)
    if (!stream) {
      toast.error(useVideo ? 'Нет доступа к камере/микрофону' : 'Нет доступа к микрофону')
      handleCallEnded()
      return
    }
    
    callStore.setLocalStream(stream)
    
    // Join MediaSoup room
    const roomId = `appointment_${callData.appointmentId}`
    const joined = await mediasoup.joinRoom(roomId)
    
    if (!joined) {
      toast.error('Не удалось подключиться')
      handleCallEnded()
      return
    }
    
  // Start producing media
    console.log('[MediaSoup Provider] Got stream, video tracks:', stream.getVideoTracks().length, 'audio tracks:', stream.getAudioTracks().length)
    await mediasoup.startProducing(stream)
    
    // Signal answer via socket
    socket.answerCall(callData.appointmentId, peerId)
    timer.reset(callData.durationMinutes)
    
  }, [callData, peerId, currentUser, isAudioOnly, mediaStream, mediasoup, socket, timer, callStore, handleCallEnded])
  
  // Reject incoming call
  const rejectCall = useCallback(() => {
    if (!callData) return
    
    socket.rejectCall(callData.appointmentId)
    setStatus('idle')
    setCallData(null)
  }, [callData, socket])
  
  // End active call
  const endCall = useCallback(() => {
    if (callData) {
      socket.endCall(callData.appointmentId)
    }
    handleCallEnded()
  }, [callData, socket, handleCallEnded])
  
  // Toggle video
  const toggleVideo = useCallback(() => {
    mediaStream.toggleVideo()
    callStore.toggleVideo()
  }, [mediaStream, callStore])
  
  // Toggle audio
  const toggleAudio = useCallback(() => {
    mediaStream.toggleAudio()
    callStore.toggleAudio()
  }, [mediaStream, callStore])
  
  // Toggle minimize
  const toggleMinimize = useCallback(() => {
    setViewMode((prev) => prev === 'minimized' ? 'fullscreen' : 'minimized')
  }, [])
  
  // Toggle pause (doctor only)
  const togglePause = useCallback(() => {
    if (timer.isPaused) {
      timer.resume()
    } else {
      timer.pause()
    }
  }, [timer])
  
  // Complete consultation (doctor only)
  const completeConsultation = useCallback(() => {
    endCall()
  }, [endCall])
  
  // Start server recording (doctor only)
  const startServerRecording = useCallback(async (recordingType?: 'video' | 'audio'): Promise<boolean> => {
    if (currentUser?.role !== 'doctor') {
      toast.error('Только врач может управлять записью')
      return false
    }
    // Default to current call type if not specified
    const type = recordingType || (isAudioOnly ? 'audio' : 'video')
    return mediasoup.startRecording(type)
  }, [currentUser, mediasoup, isAudioOnly])
  
  // Stop server recording (doctor only)
  const stopServerRecording = useCallback(async (): Promise<string | null> => {
    if (currentUser?.role !== 'doctor') {
      toast.error('Только врач может управлять записью')
      return null
    }
    return mediasoup.stopRecording()
  }, [currentUser, mediasoup])
  
  // Handle incoming call from socket
  useEffect(() => {
    const handleIncomingCall = () => {
      const { status: storeStatus, callerName, appointmentId, remotePeerId, isIncomingAudioOnly } = callStore
      
      if (storeStatus === 'incoming' && callerName && appointmentId && status === 'idle') {
        const caller: CallParticipant = {
          odooUserId: 0,
          odooPartnerId: 0,
          odooPartnerName: callerName,
          peerId: remotePeerId || '',
          role: currentUser?.role === 'doctor' ? 'patient' : 'doctor',
        }
        
        setIsAudioOnly(isIncomingAudioOnly)
        setStatus('incoming')
        setCallData({
          appointmentId,
          durationMinutes: 30,
          participant: caller,
          isOutgoing: false,
        })
      }
    }
    
    handleIncomingCall()
  }, [callStore, currentUser, status])
  
  // Handle call answered - change status from 'calling' to 'connecting'
  useEffect(() => {
    const { remoteAnswered } = callStore
    
    if (remoteAnswered && status === 'calling') {
      console.log('[MediaSoup Provider] Remote answered, changing status to connecting')
      setStatus('connecting')
    }
  }, [callStore, status])
  
  // Clear call timeout when status changes to connecting or connected
  useEffect(() => {
    if (status === 'connecting' || status === 'connected') {
      clearCallTimeout()
    }
  }, [status, clearCallTimeout])
  
  // Handle call ended from remote side
  useEffect(() => {
    const unsubscribe = socket.onRemoteCallEnded(async (appointmentId) => {
      const currentStatus = statusRef.current
      if (currentStatus === 'connected' || currentStatus === 'connecting' || currentStatus === 'calling') {
        await handleCallEnded()
      }
    })
    
    return unsubscribe
  }, [socket, handleCallEnded])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearCallTimeout()
      connectionQuality.stopMonitoring()
      mediaStream.stopStream()
      mediasoup.cleanup()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  
  const contextValue: MediaSoupVideoCallContextValue = {
    // State
    status,
    callData: callData ? {
      appointmentId: callData.appointmentId,
      caller: callData.isOutgoing ? currentUser! : callData.participant,
      callee: callData.isOutgoing ? callData.participant : currentUser!,
      durationMinutes: callData.durationMinutes,
    } : null,
    localStream: mediaStream.stream,
    remoteStream,
    mediaState,
    connectionQuality: connectionQuality.quality,
    viewMode,
    remainingSeconds: timer.remainingSeconds,
    isPaused: timer.isPaused,
    isSavingRecording: false, // Server handles this
    isAudioOnly,
    
    // MediaSoup-specific
    isServerRecording: mediasoup.isRecording,
    recordingSessionId: mediasoup.recordingSessionId,
    
    // Actions
    startCall,
    startAudioCall,
    answerCall,
    rejectCall,
    endCall,
    toggleVideo,
    toggleAudio,
    toggleMinimize,
    togglePause,
    completeConsultation,
    
    // MediaSoup-specific actions
    startServerRecording,
    stopServerRecording,
    
    // User info
    currentUser,
    role,
  }
  
  return (
    <VideoCallContext.Provider value={contextValue}>
      {children}
    </VideoCallContext.Provider>
  )
}

export function useVideoCallMediaSoup() {
  const context = useContext(VideoCallContext)
  if (!context) {
    throw new Error('useVideoCallMediaSoup must be used within a VideoCallProviderMediaSoup')
  }
  return context
}

// Safe hook for optional usage
export function useVideoCallMediaSoupSafe() {
  return useContext(VideoCallContext)
}
