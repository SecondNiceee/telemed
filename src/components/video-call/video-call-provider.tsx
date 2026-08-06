'use client'

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
import type { MediaConnection } from 'peerjs'
import PeerJS from 'peerjs'
import type Peer from 'peerjs'
import { toast } from 'sonner'
import { useSocket } from '@/components/socket-provider'
import { useCallStore } from '@/stores/call-store'
import { useUserStore } from '@/stores/user-store'
import { useDoctorStore } from '@/stores/doctor-store'
import { useMediaStream } from './hooks/use-media-stream'
import { useCallTimer } from './hooks/use-call-timer'
import { useConnectionQuality } from './hooks/use-connection-quality'
import { useCallRecording } from './hooks/use-call-recording'
import { CALL_TIMEOUTS, ICE_SERVERS } from '@/lib/video-call/config'
import type {
  CallStatus,
  CallViewMode,
  CallParticipant,
  CallRole,
  MediaState,
  VideoCallContextValue,
} from '@/lib/video-call/types'

const VideoCallContext = createContext<VideoCallContextValue | null>(null)

interface VideoCallProviderProps {
  children: ReactNode
}

export function VideoCallProvider({ children }: VideoCallProviderProps) {
  // Get current user from stores
  const user = useUserStore((state) => state.user)
  const doctor = useDoctorStore((state) => state.doctor)
  
  // Generate unique tab ID once per component mount to avoid "ID is taken" error
  const tabIdRef = useRef<string>('')
  if (typeof window !== 'undefined' && !tabIdRef.current) {
    tabIdRef.current = `_${Date.now().toString(36)}`
  }
  
  // Derive currentUser from available data
  const currentUser = useMemo<CallParticipant | null>(() => {
    console.log('[VideoCallProvider] Determining currentUser - doctor:', doctor?.id, doctor?.name, 'user:', user?.id, user?.name)
    const tabSuffix = tabIdRef.current
    if (doctor) {
      const peerId = `doctor_${doctor.id}${tabSuffix}`
      console.log('[VideoCallProvider] Using doctor as currentUser:', peerId)
      return {
        odooUserId: doctor.id,
        odooPartnerId: doctor.id,
        odooPartnerName: doctor.name || 'Doctor',
        peerId,
        basePeerId: `doctor_${doctor.id}`, // For socket signaling (without tab suffix)
        role: 'doctor' as const,
      }
    }
    if (user) {
      const peerId = `patient_${user.id}${tabSuffix}`
      console.log('[VideoCallProvider] Using user as currentUser:', peerId)
      return {
        odooUserId: user.id,
        odooPartnerId: user.id,
        odooPartnerName: user.name || 'User',
        peerId,
        basePeerId: `patient_${user.id}`, // For socket signaling (without tab suffix)
        role: 'patient' as const,
      }
    }
    console.log('[VideoCallProvider] No currentUser found')
    return null
  }, [doctor, user])
  
  // Zustand store for shared state
  const callStore = useCallStore()
  
  // Socket for signaling
  const socket = useSocket()
  
  // Local state
  const [status, setStatus] = useState<CallStatus>('idle')
  const statusRef = useRef<CallStatus>('idle')
  const [isAudioOnly, setIsAudioOnly] = useState(false)
  const isAudioOnlyRef = useRef(false)
  
  // Keep statusRef in sync
  useEffect(() => {
    statusRef.current = status
  }, [status])
  // Keep isAudioOnlyRef in sync
  useEffect(() => {
    isAudioOnlyRef.current = isAudioOnly
  }, [isAudioOnly])
  const [viewMode, setViewMode] = useState<CallViewMode>('fullscreen')
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [callData, setCallData] = useState<{
    appointmentId: number
    durationMinutes: number
    participant: CallParticipant
    isOutgoing: boolean
  } | null>(null)
  const callDataRef = useRef(callData)
  
  // Keep callDataRef in sync
  useEffect(() => {
    callDataRef.current = callData
  }, [callData])
  
  // Refs for call management
  const peerRef = useRef<Peer | null>(null)
  const currentCallRef = useRef<MediaConnection | null>(null)
  const pendingCallRef = useRef<MediaConnection | null>(null)
  const callTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const setupCallHandlersRef = useRef<(call: MediaConnection) => void>(() => {})
  
  // Hooks
  const mediaStream = useMediaStream()
  const mediaStreamRef = useRef(mediaStream)
  const timer = useCallTimer(0)
  const connectionQuality = useConnectionQuality()
  const recording = useCallRecording()
  
  // Keep mediaStreamRef in sync
  useEffect(() => {
    mediaStreamRef.current = mediaStream
  }, [mediaStream])
  
  // Generate peer ID from user info
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
  
  // Clean up call timeout
  const clearCallTimeout = useCallback(() => {
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current)
      callTimeoutRef.current = null
    }
  }, [])
  
  // Use ref for peerId to avoid recreating initPeer callback
  const peerIdRef = useRef(peerId)
  useEffect(() => {
    peerIdRef.current = peerId
  }, [peerId])
  
  // Initialize peer connection
  const initPeer = useCallback(async (): Promise<Peer | null> => {
    const currentPeerId = peerIdRef.current
    if (!currentPeerId) return null
    if (peerRef.current?.open) return peerRef.current
    
    try {
      // Clean up existing peer
      if (peerRef.current) {
        peerRef.current.destroy()
      }
      
      const peerHost = process.env.NEXT_PUBLIC_PEER_HOST || 'smartcardio.ru'
      const peerPort = parseInt(process.env.NEXT_PUBLIC_PEER_PORT || '443', 10)
      const peerPath = process.env.NEXT_PUBLIC_PEER_PATH || '/telemed-dev/peerjs'
      // Use secure connection only for non-localhost hosts
      const isSecure = peerHost !== 'localhost' && peerHost !== '127.0.0.1'
      
      console.log('[VideoCallProvider] Connecting to PeerJS:', { peerHost, peerPort, peerPath, peerId: currentPeerId, secure: isSecure })
      
      const peer = new PeerJS(currentPeerId, {
        host: peerHost,
        port: peerPort,
        path: peerPath,
        secure: isSecure,
        key: 'peerjs', // Должен совпадать с ключом на сервере
        debug: 2, // Всегда включаем debug для диагностики
        config: {
          iceServers: [...ICE_SERVERS] as RTCIceServer[],
        },
      })
      
      return new Promise((resolve) => {
        peer.on('open', (id) => {
          console.log('[VideoCallProvider] Peer connected:', id)
          peerRef.current = peer
          callStore.setPeer(peer)
          callStore.setPeerId(id)
          resolve(peer)
        })
        
        peer.on('call', (incomingCall: MediaConnection) => {
          console.log('[VideoCallProvider] Incoming peer call from:', incomingCall.peer)
          console.log('[VideoCallProvider] Current status:', statusRef.current)
          console.log('[VideoCallProvider] Has local stream:', !!mediaStreamRef.current.stream)
          
          // If we're in connecting state and have a stream, answer immediately
          // This handles the case where patient clicked "Answer" before the peer call arrived
          if (statusRef.current === 'connecting' && mediaStreamRef.current.stream) {
            console.log('[VideoCallProvider] Auto-answering incoming peer call (already in connecting state)')
            incomingCall.answer(mediaStreamRef.current.stream)
            currentCallRef.current = incomingCall
            setupCallHandlersRef.current(incomingCall)
          } else {
            // Store for later answering
            pendingCallRef.current = incomingCall
          }
        })
        
        peer.on('error', (err) => {
          console.error('[VideoCallProvider] Peer error:', err)
          if (err.type !== 'peer-unavailable') {
            toast.error(`Ошибка соединения: ${err.type}`)
          }
          resolve(null)
        })
        
        peer.on('disconnected', () => {
          console.log('[VideoCallProvider] Peer disconnected, destroyed:', peer.destroyed)
          // Don't auto-reconnect - let initPeer handle reconnection when needed
          // Auto-reconnect can cause infinite loops if server rejects the connection
        })
        
        peer.on('close', () => {
          console.log('[VideoCallProvider] Peer connection closed')
        })
        
        // Timeout
        setTimeout(() => {
          if (!peer.open) {
            console.error('[VideoCallProvider] Peer connection timeout')
            peer.destroy()
            resolve(null)
          }
        }, 10000)
      })
    } catch (err) {
      console.error('[VideoCallProvider] Failed to init peer:', err)
      return null
    }
  // callStore is stable (zustand store), so this callback won't change
  }, [callStore])
  
  // Ref to prevent multiple calls to handleCallEnded
  const isHandlingCallEndedRef = useRef(false)
  
  // Handle call ended
  const handleCallEnded = useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (isHandlingCallEndedRef.current) {
      console.log('[VideoCallProvider] handleCallEnded already in progress, skipping')
      return
    }
    isHandlingCallEndedRef.current = true
    
    console.log('[VideoCallProvider] handleCallEnded started')
    
    clearCallTimeout()
    connectionQuality.stopMonitoring()
    timer.pause()

    // Use ref to get current callData value (avoids stale closure when patient ends the call)
    const currentCallData = callDataRef.current
    const wasAudioOnly = isAudioOnlyRef.current

    // Stop recording and finalize for doctor
    // This runs on doctor's side regardless of who ended the call
    // Use isRecordingRef to get CURRENT value (not stale closure from state)
    const wasRecording = recording.isRecordingRef.current
    console.log('[VideoCallProvider] Checking recording conditions:', {
      role: currentUser?.role,
      isRecording: recording.isRecording,
      isRecordingRef: wasRecording,
      appointmentId: currentCallData?.appointmentId,
    })
    
    // Use isRecordingRef to check if recording was active (avoids stale closure issues)
    if (currentUser?.role === 'doctor' && wasRecording && currentCallData?.appointmentId) {
      const doctorId = currentUser.odooUserId
      console.log('[Recording] Call ended, stopping and finalizing:', { 
        appointmentId: currentCallData.appointmentId, 
        doctorId,
        whoEndedCall: 'handling on doctor side',
        isAudioOnly: wasAudioOnly
      })
      
      console.log('[Recording] Calling stopRecording...')
      const blob = await recording.stopRecording()
      console.log('[Recording] stopRecording completed, blob size:', blob?.size || 0)
      
      // Upload/finalize - this will either finalize server chunks or upload client blob
      // Pass isAudioOnly to set correct recordingType
      console.log('[Recording] Calling uploadRecording...')
      const uploadResult = await recording.uploadRecording(currentCallData.appointmentId, doctorId, blob || undefined, wasAudioOnly)
      console.log('[Recording] uploadRecording completed, success:', uploadResult)
    } else {
      console.log('[VideoCallProvider] Skipping recording finalization - conditions not met:', {
        role: currentUser?.role,
        isRecording: recording.isRecording,
        isRecordingRef: wasRecording,
        hasAppointmentId: !!currentCallData?.appointmentId,
      })
    }
    
    mediaStream.stopStream()
    
    if (currentCallRef.current) {
      currentCallRef.current.close()
      currentCallRef.current = null
    }
    
    setRemoteStream(null)
    setStatus('ended')
    setCallData(null)
    callStore.endCall()
    
    // Reset to idle after animation
    setTimeout(() => {
      setStatus('idle')
      setViewMode('fullscreen')
      setIsAudioOnly(false)
      isHandlingCallEndedRef.current = false // Reset flag for next call
    }, 1000)
    
    console.log('[VideoCallProvider] handleCallEnded completed')
  // Note: Using callDataRef.current instead of callData to avoid stale closure issues
  }, [clearCallTimeout, connectionQuality, timer, mediaStream, callStore, currentUser, recording])
  
  // Setup call handlers
  const setupCallHandlers = useCallback((call: MediaConnection) => {
    call.on('stream', (stream: MediaStream) => {
      console.log('[VideoCallProvider] Received remote stream')
      setRemoteStream(stream)
      setStatus('connected')
      timer.start()
      
      // Start quality monitoring
      const peerConnection = (call as MediaConnection & { peerConnection?: RTCPeerConnection }).peerConnection
      if (peerConnection) {
        connectionQuality.startMonitoring(peerConnection)
      }

      // Start recording for doctors with chunk upload
      // Pass both local and remote streams so the hook can create PiP composite (doctor main, patient small)
      // For audio-only calls, pass isAudioOnly flag to record audio only
      if (currentUser?.role === 'doctor' && mediaStreamRef.current.stream && callDataRef.current?.appointmentId) {
        const appointmentId = callDataRef.current.appointmentId
        const doctorId = currentUser.odooUserId
        const audioOnly = isAudioOnlyRef.current
        console.log('[Recording] Starting for doctor, appointmentId:', appointmentId, 'doctorId:', doctorId, 'isAudioOnly:', audioOnly)
        
        // Pass local (doctor) stream as main, remote (patient) stream for PiP overlay (video) or just audio
        recording.startRecording(mediaStreamRef.current.stream, appointmentId, doctorId, stream, audioOnly)
      }
    })
    
    call.on('close', () => {
      console.log('[VideoCallProvider] Call closed')
      handleCallEnded()
    })
    
    call.on('error', (err) => {
      console.error('[VideoCallProvider] Call error:', err)
      toast.error('Ошибка соединения')
      handleCallEnded()
    })
  }, [timer, connectionQuality, handleCallEnded, currentUser?.role, recording])
  
  // Keep setupCallHandlersRef in sync
  useEffect(() => {
    setupCallHandlersRef.current = setupCallHandlers
  }, [setupCallHandlers])
  
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
    
    // Initialize peer
    const peer = await initPeer()
    if (!peer) {
      toast.error('Не удалось подключиться к серверу')
      setStatus('idle')
      setCallData(null)
      return
    }
    
    // Get media stream (video + audio)
    const stream = await mediaStream.getStream(true, true)
    if (!stream) {
      toast.error('Нет доступа к камере/микрофону')
      setStatus('idle')
      setCallData(null)
      return
    }
    
    callStore.setLocalStream(stream)
    
    // Signal call via socket
    console.log('[v0] ======= STARTING VIDEO CALL =======')
    console.log('[v0] socket.isConnected:', socket.isConnected)
    console.log('[v0] socket.socket?.connected:', socket.socket?.connected)
    console.log('[v0] appointmentId:', appointmentId)
    console.log('[v0] peerId (my peer):', peerId)
    console.log('[v0] callee.peerId (remote peer):', callee.peerId)
    console.log('[v0] currentUser.odooPartnerName:', currentUser.odooPartnerName)
    
    socket.initiateCall(appointmentId, peerId, currentUser.odooPartnerName)
    console.log('[v0] initiateCall emitted')
    
    callStore.startCall(appointmentId, callee.peerId)
    
    // Set call timeout - use statusRef to get current value in closure
    callTimeoutRef.current = setTimeout(() => {
      console.log('[VideoCallProvider] Call timeout check, status:', statusRef.current)
      if (statusRef.current === 'calling') {
        toast.error('Нет ответа')
        handleCallEnded()
      }
    }, CALL_TIMEOUTS.CALL_TIMEOUT)
    
  }, [currentUser, peerId, initPeer, mediaStream, socket, callStore, timer, handleCallEnded])
  
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
    
    // Initialize peer
    const peer = await initPeer()
    if (!peer) {
      toast.error('Не удалось подключиться к серверу')
      setStatus('idle')
      setCallData(null)
      setIsAudioOnly(false)
      return
    }
    
    // Get media stream (audio only, no video)
    const stream = await mediaStream.getStream(false, true)
    if (!stream) {
      toast.error('Нет доступа к микрофону')
      setStatus('idle')
      setCallData(null)
      setIsAudioOnly(false)
      return
    }
    
    callStore.setLocalStream(stream)
    
    // Signal call via socket (with isAudioOnly=true)
    console.log('[v0] ======= STARTING AUDIO CALL =======')
    console.log('[v0] socket.isConnected:', socket.isConnected)
    console.log('[v0] socket.socket?.connected:', socket.socket?.connected)
    console.log('[v0] appointmentId:', appointmentId)
    console.log('[v0] peerId (my peer):', peerId)
    console.log('[v0] callee.peerId (remote peer):', callee.peerId)
    console.log('[v0] currentUser.odooPartnerName:', currentUser.odooPartnerName)
    console.log('[v0] isAudioOnly: true')
    
    socket.initiateCall(appointmentId, peerId, currentUser.odooPartnerName, true)
    console.log('[v0] initiateCall emitted with isAudioOnly=true')
    
    callStore.startCall(appointmentId, callee.peerId)
    
    // Set call timeout
    callTimeoutRef.current = setTimeout(() => {
      console.log('[VideoCallProvider] Audio call timeout check, status:', statusRef.current)
      if (statusRef.current === 'calling') {
        toast.error('Нет ответа')
        handleCallEnded()
      }
    }, CALL_TIMEOUTS.CALL_TIMEOUT)
    
  }, [currentUser, peerId, initPeer, mediaStream, socket, callStore, timer, handleCallEnded])
  
  // Answer incoming call
  const answerCall = useCallback(async () => {
    if (!callData || !peerId) return
    
    setStatus('connecting')
    
    // Initialize peer if needed
    const peer = await initPeer()
    if (!peer) {
      toast.error('Не удалось подключиться')
      handleCallEnded()
      return
    }
    
    // Get media stream based on call type (audio-only or video)
    const useVideo = !isAudioOnlyRef.current
    const stream = await mediaStream.getStream(useVideo, true)
    if (!stream) {
      toast.error(useVideo ? 'Нет доступа к камере/микрофону' : 'Нет доступа к микрофону')
      handleCallEnded()
      return
    }
    
    callStore.setLocalStream(stream)
    
    // Answer the pending call if we have one
    if (pendingCallRef.current) {
      pendingCallRef.current.answer(stream)
      currentCallRef.current = pendingCallRef.current
      setupCallHandlers(pendingCallRef.current)
      pendingCallRef.current = null
    }
    
    // Signal answer via socket
    socket.answerCall(callData.appointmentId, peerId)
    timer.reset(callData.durationMinutes)
    
  }, [callData, peerId, initPeer, mediaStream, callStore, socket, timer, setupCallHandlers, handleCallEnded])
  
  // Reject incoming call
  const rejectCall = useCallback(() => {
    if (!callData) return
    
    socket.rejectCall(callData.appointmentId)
    
    if (pendingCallRef.current) {
      pendingCallRef.current.close()
      pendingCallRef.current = null
    }
    
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
    // End call and navigate to summary
    endCall()
    // Additional logic can be added here for completing the consultation
  }, [endCall])
  
  // Track if we've already tried to initialize peer
  const peerInitializedRef = useRef(false)
  
  // Initialize peer connection early so we can receive incoming calls
  // Only initialize once when peerId becomes available
  useEffect(() => {
    if (peerId && !peerRef.current && !peerInitializedRef.current) {
      peerInitializedRef.current = true
      console.log('[VideoCallProvider] Pre-initializing peer for incoming calls')
      initPeer()
    }
  }, [peerId, initPeer])
  
  // Handle incoming call from socket
  useEffect(() => {
    const handleIncomingCall = () => {
      const { status: storeStatus, callerName, appointmentId, remotePeerId, isIncomingAudioOnly } = callStore
      
      console.log('[VideoCallProvider] Checking incoming call - storeStatus:', storeStatus, 'callerName:', callerName, 'localStatus:', status, 'isAudioOnly:', isIncomingAudioOnly)
      
      if (storeStatus === 'incoming' && callerName && appointmentId && status === 'idle') {
        console.log('[VideoCallProvider] Incoming call detected from store, showing UI, isAudioOnly:', isIncomingAudioOnly)
        
        // Create participant from store data
        const caller: CallParticipant = {
          odooUserId: 0, // Will be filled from actual data
          odooPartnerId: 0,
          odooPartnerName: callerName,
          peerId: remotePeerId || '',
          role: currentUser?.role === 'doctor' ? 'patient' : 'doctor',
        }
        
        // Set isAudioOnly based on incoming call type
        setIsAudioOnly(isIncomingAudioOnly)
        setStatus('incoming')
        setCallData({
          appointmentId,
          durationMinutes: 30, // Default, should come from appointment
          participant: caller,
          isOutgoing: false,
        })
      }
    }
    
    handleIncomingCall()
  }, [callStore, currentUser, status])
  
  // Handle call ended from remote side (e.g., patient ends the call)
  // Using socket callback to handle recording BEFORE store is updated (which clears appointmentId, streams, etc.)
  // IMPORTANT: This callback is async and socket-provider will await it before clearing the store
  useEffect(() => {
    const unsubscribe = socket.onRemoteCallEnded(async (appointmentId) => {
      // Use statusRef to get the CURRENT status value (not stale closure value)
      const currentStatus = statusRef.current
      console.log('[VideoCallProvider] Remote party ended call via socket callback, appointmentId:', appointmentId, 'status:', currentStatus)
      
      // Only handle if we are in an active call state
      if (currentStatus === 'connected' || currentStatus === 'connecting' || currentStatus === 'calling') {
        console.log('[VideoCallProvider] Triggering handleCallEnded from socket callback (async)')
        // IMPORTANT: We must await handleCallEnded to ensure recording is saved before store is cleared
        await handleCallEnded()
        console.log('[VideoCallProvider] handleCallEnded completed')
      } else {
        console.log('[VideoCallProvider] Skipping handleCallEnded - not in active call state, currentStatus:', currentStatus)
      }
    })
    
    return unsubscribe
  }, [socket, handleCallEnded])
  
  // Handle call answered (for outgoing calls only)
  // This effect triggers when the remote peer ACTUALLY answers our outgoing call
  useEffect(() => {
    const remotePeerId = callStore.remotePeerId
    const remoteAnswered = callStore.remoteAnswered // Check if remote actually answered
    const storeStatus = callStore.status
    
    // Only proceed if:
    // 1. We are in 'calling' state (we initiated the call)
    // 2. The remote peer has ACTUALLY answered (remoteAnswered flag is true)
    // 3. We have a remote peer ID
    // 4. We have peer and stream ready
    // 5. This is an outgoing call
    if (
      status === 'calling' && 
      remoteAnswered && // This is the key check - only proceed if remote answered via socket
      remotePeerId && 
      peerRef.current && 
      mediaStream.stream &&
      callData?.isOutgoing
    ) {
      console.log('[VideoCallProvider] Remote peer answered our outgoing call, calling:', remotePeerId)
      
      setStatus('connecting')
      
      const call = peerRef.current.call(remotePeerId, mediaStream.stream)
      currentCallRef.current = call
      callStore.setCurrentCall(call)
      setupCallHandlers(call)
      clearCallTimeout()
    }
  }, [callStore.remotePeerId, callStore.remoteAnswered, callStore.status, status, mediaStream.stream, setupCallHandlers, callStore, clearCallTimeout, callData?.isOutgoing])
  
  // Cleanup on unmount only - use refs to avoid dependency changes triggering cleanup
  const clearCallTimeoutRef = useRef(clearCallTimeout)
  const connectionQualityRef = useRef(connectionQuality)
  
  useEffect(() => {
    clearCallTimeoutRef.current = clearCallTimeout
    connectionQualityRef.current = connectionQuality
  })
  
  useEffect(() => {
    return () => {
      clearCallTimeoutRef.current()
      connectionQualityRef.current.stopMonitoring()
      mediaStreamRef.current.stopStream()
      
      if (currentCallRef.current) {
        currentCallRef.current.close()
      }
      if (peerRef.current) {
        peerRef.current.destroy()
      }
    }
  // Empty deps - only run cleanup on actual unmount
  }, [])
  
  const contextValue: VideoCallContextValue = {
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
    peer: peerRef.current,
    currentCall: currentCallRef.current,
    isSavingRecording: recording.isUploading,
    isAudioOnly,
    
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

export function useVideoCall() {
  const context = useContext(VideoCallContext)
  if (!context) {
    throw new Error('useVideoCall must be used within a VideoCallProvider')
  }
  return context
}

// Safe hook for optional usage (returns null if outside provider)
export function useVideoCallSafe() {
  return useContext(VideoCallContext)
}
