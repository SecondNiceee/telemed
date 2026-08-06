'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useChatStore } from '@/stores/chat-store'
import { useCallStore } from '@/stores/call-store'
import { useUserStore } from '@/stores/user-store'
import { useDoctorStore } from '@/stores/doctor-store'
import type { ApiMessage } from '@/lib/api/messages'
import { getSenderType, getSenderId } from '@/lib/api/messages'

interface SocketContextValue {
  socket: Socket | null
  isConnected: boolean
  joinRoom: (appointmentId: number) => void
  leaveRoom: (appointmentId: number) => void
  sendMessage: (appointmentId: number, text: string, attachmentId?: number) => void
  markAsRead: (appointmentId: number) => void
  startTyping: (appointmentId: number) => void
  stopTyping: (appointmentId: number) => void
  // Video call signaling
  initiateCall: (appointmentId: number, callerPeerId: string, callerName: string, isAudioOnly?: boolean) => void
  answerCall: (appointmentId: number, answerPeerId: string) => void
  rejectCall: (appointmentId: number) => void
  endCall: (appointmentId: number) => void
  // Callback for when remote party ends call (before store is updated)
  // Callback can be async - socket-provider will await it before updating store
  onRemoteCallEnded: (callback: (appointmentId: number) => void | Promise<void>) => () => void
  // Consultation management
  startConsultation: (appointmentId: number) => void
  endConsultation: (appointmentId: number) => void
  blockChat: (appointmentId: number) => void
  unblockChat: (appointmentId: number) => void
  changeConnectionType: (appointmentId: number, connectionType: 'chat' | 'audio' | 'video') => void
}

const SocketContext = createContext<SocketContextValue | null>(null)

interface SocketProviderProps {
  children: ReactNode
  currentSenderType?: 'user' | 'doctor'
  currentSenderId?: number
}

// Play notification sound
function playNotificationSound() {
  try {
    // Create audio context for notification sound
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    // Pleasant notification sound
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime) // A5
    oscillator.frequency.setValueAtTime(1100, audioContext.currentTime + 0.1) // C#6
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
    
    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.3)
  } catch {
    // Audio not supported or blocked
    console.log('[Socket] Could not play notification sound')
  }
}

export function SocketProvider({ children, currentSenderType, currentSenderId }: SocketProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  // Use refs for store functions to avoid reconnection on store changes
  const chatStoreRef = useRef(useChatStore.getState())
  const callStoreRef = useRef(useCallStore.getState())
  
  // Callbacks for remote call ended - allows VideoCallProvider to handle recording before store updates
  // Callbacks can be async - we will await them before updating the store
  const remoteCallEndedCallbacksRef = useRef<Set<(appointmentId: number) => void | Promise<void>>>(new Set())
  
  // Subscribe to store updates via refs (not dependencies)
  useEffect(() => {
    const unsubChat = useChatStore.subscribe((state) => {
      chatStoreRef.current = state
    })
    const unsubCall = useCallStore.subscribe((state) => {
      callStoreRef.current = state
    })
    return () => {
      unsubChat()
      unsubCall()
    }
  }, [])
  
  // Track current sender info in refs to use in socket event handlers
  const currentSenderTypeRef = useRef(currentSenderType)
  const currentSenderIdRef = useRef(currentSenderId)
  
  useEffect(() => {
    currentSenderTypeRef.current = currentSenderType
    currentSenderIdRef.current = currentSenderId
  }, [currentSenderType, currentSenderId])

  useEffect(() => {
    // Connect to the separate Socket.io server
    // In production, use the same domain with a custom path (proxied via nginx)
    // In development, connect directly to port 3001
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001'
    const socketPath = process.env.NEXT_PUBLIC_SOCKET_PATH || '/socket.io'

    const newSocket = io(socketUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      autoConnect: true,
      path: socketPath,
    })

    newSocket.on('connect', () => {
      console.log('[Socket] Connected:', newSocket.id)
      setIsConnected(true)
    })

    newSocket.on('disconnect', () => {
      console.log('[Socket] Disconnected')
      setIsConnected(false)
    })

    newSocket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message)
      setIsConnected(false)
    })

    // Handle new messages
    newSocket.on('new-message', (message: ApiMessage) => {
      chatStoreRef.current.addMessage(message)
      
      const msgAppointmentId = typeof message.appointment === 'object' 
        ? message.appointment.id 
        : message.appointment
      
      // Check if this is a message from the other party (not from us)
      const messageSenderType = getSenderType(message)
      const messageSenderId = getSenderId(message)
      // isOwnMessage только если можем определить тип и он совпадает
      const isOwnMessage = messageSenderType !== null && 
                           messageSenderType === currentSenderTypeRef.current && 
                           messageSenderId === currentSenderIdRef.current
      
      // Play sound and increment unread if:
      // 1. Not our own message AND
      // 2. Either not in active chat OR tab is not visible
      if (!isOwnMessage) {
        const isTabVisible = document.visibilityState === 'visible'
        const isInActiveChat = chatStoreRef.current.activeAppointmentId === msgAppointmentId
        
        if (!isInActiveChat || !isTabVisible) {
          chatStoreRef.current.incrementUnreadCount(msgAppointmentId)
          // Play notification sound if tab is not visible
          if (!isTabVisible) {
            playNotificationSound()
          }
        }
      }
    })

    // Handle typing indicators
    newSocket.on('user-typing', ({ appointmentId, senderType, senderId }) => {
      chatStoreRef.current.setTypingUser(appointmentId, { senderType, senderId })
    })

    newSocket.on('user-stop-typing', ({ appointmentId }) => {
      chatStoreRef.current.setTypingUser(appointmentId, null)
    })

    // Handle messages marked as read
    newSocket.on('messages-read', ({ appointmentId, readBy }) => {
      // Mark messages from the OTHER party as read
      // If readBy is 'user', mark all 'doctor' messages as read (user read them)
      // If readBy is 'doctor', mark all 'user' messages as read (doctor read them)
      const senderTypeToMarkRead = readBy === 'user' ? 'doctor' : 'user'
      chatStoreRef.current.markMessagesAsReadByType(appointmentId, senderTypeToMarkRead)
    })

    // Handle errors
    newSocket.on('error', ({ message }) => {
      console.error('[Socket] Error:', message)
    })

    // Video call signaling events
    newSocket.on('incoming-call', ({ appointmentId, callerPeerId, callerName, callerType, isAudioOnly }) => {
      console.log('[v0] ======= INCOMING CALL EVENT =======')
      console.log('[v0] appointmentId:', appointmentId)
      console.log('[v0] callerPeerId:', callerPeerId)
      console.log('[v0] callerName:', callerName)
      console.log('[v0] callerType:', callerType)
      console.log('[v0] isAudioOnly:', isAudioOnly)
      console.log('[v0] currentSenderType:', currentSenderTypeRef.current)
      console.log('[v0] currentSenderId:', currentSenderIdRef.current)
      // Only handle if we're not the caller (different sender type)
      console.log('[v0] Checking if we should handle this call: callerType !== currentSenderType?', callerType, '!==', currentSenderTypeRef.current, '=', callerType !== currentSenderTypeRef.current)
      if (callerType !== currentSenderTypeRef.current) {
        console.log('[v0] This is an incoming call for us! Triggering receiveCall in callStore')
        // IMPORTANT: First trigger receiveCall to set status to 'incoming'
        // Then set remotePeerId - this order prevents the outgoing call effect from triggering
        callStoreRef.current.receiveCall(null as never, callerName, appointmentId, isAudioOnly)
        console.log('[v0] receiveCall called, now setting remotePeerId after timeout')
        // Set remote peer ID after status is set to 'incoming'
        // This ensures the video-call-provider won't mistake this for an answered outgoing call
        setTimeout(() => {
          console.log('[v0] Setting remotePeerId:', callerPeerId)
          callStoreRef.current.setRemotePeerId(callerPeerId)
        }, 0)
      } else {
        console.log('[v0] Ignoring incoming-call - same sender type (we initiated this call)')
      }
    })

    newSocket.on('call-answered', ({ appointmentId, answerPeerId }) => {
      console.log('[Socket] Call answered, remote peer:', answerPeerId)
      callStoreRef.current.setRemotePeerId(answerPeerId)
      callStoreRef.current.setRemoteAnswered(true) // Signal that remote actually answered
    })

    newSocket.on('call-rejected', ({ appointmentId }) => {
      console.log('[Socket] Call rejected')
      callStoreRef.current.endCall()
    })

    newSocket.on('call-ended', async ({ appointmentId }) => {
      console.log('[Socket] Call ended by remote, appointmentId:', appointmentId, 'callbacks count:', remoteCallEndedCallbacksRef.current.size)
      
      // IMPORTANT: Call all registered callbacks BEFORE updating the store
      // This allows VideoCallProvider to stop recording and save video before store resets data
      // We MUST await all callbacks to ensure recording is saved before store is cleared
      const callbackPromises: Promise<void>[] = []
      remoteCallEndedCallbacksRef.current.forEach(callback => {
        try {
          const result = callback(appointmentId)
          // If callback returns a promise, track it
          if (result instanceof Promise) {
            callbackPromises.push(result.catch(err => {
              console.error('[Socket] Error in async remoteCallEnded callback:', err)
            }))
          }
        } catch (err) {
          console.error('[Socket] Error in remoteCallEnded callback:', err)
        }
      })
      
      // Wait for all async callbacks to complete (e.g., recording finalization)
      if (callbackPromises.length > 0) {
        console.log('[Socket] Waiting for', callbackPromises.length, 'async callbacks to complete...')
        await Promise.all(callbackPromises)
        console.log('[Socket] All async callbacks completed')
      }
      
      // Now update the store (this will reset appointmentId, streams, etc.)
      callStoreRef.current.endCall()
    })

    // Consultation status events
    newSocket.on('consultation-started', ({ appointmentId, message }) => {
      console.log('[Socket] Consultation started:', appointmentId)
      chatStoreRef.current.updateAppointmentStatus(appointmentId, 'in_progress')
      
      // Add system message to chat
      if (message) {
        chatStoreRef.current.addMessage(message)
      }
    })

    newSocket.on('consultation-ended', ({ appointmentId, message }) => {
      console.log('[Socket] Consultation ended:', appointmentId)
      chatStoreRef.current.updateAppointmentStatus(appointmentId, 'completed')
      
      // Add system message to chat
      if (message) {
        chatStoreRef.current.addMessage(message)
      }
    })

    newSocket.on('chat-blocked', ({ appointmentId }) => {
      console.log('[Socket] Chat blocked:', appointmentId)
      chatStoreRef.current.setChatBlocked(appointmentId, true)
    })

    newSocket.on('chat-unblocked', ({ appointmentId }) => {
      console.log('[Socket] Chat unblocked:', appointmentId)
      chatStoreRef.current.setChatBlocked(appointmentId, false)
    })

    // Connection type change events
    newSocket.on('connection-type-changed', ({ appointmentId, connectionType, message }) => {
      console.log('[Socket] Connection type changed:', appointmentId, connectionType)
      chatStoreRef.current.setConnectionType(appointmentId, connectionType)
      
      // Add system message to chat
      if (message) {
        chatStoreRef.current.addMessage(message)
      }
      
      // Play notification sound for doctors
      if (currentSenderTypeRef.current === 'doctor') {
        playNotificationSound()
      }
    })

    setSocket(newSocket)

    return () => {
      newSocket.disconnect()
    }
  // Empty dependency array - socket should only connect once when the component mounts
  // All store updates are handled via refs to avoid reconnection
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const joinRoom = useCallback((appointmentId: number) => {
    if (socket?.connected) {
      socket.emit('join-room', { appointmentId })
    }
  }, [socket])

  const leaveRoom = useCallback((appointmentId: number) => {
    if (socket?.connected) {
      socket.emit('leave-room', { appointmentId })
    }
  }, [socket])

  const sendMessage = useCallback((appointmentId: number, text: string, attachmentId?: number) => {
    if (socket?.connected) {
      socket.emit('send-message', { 
        appointmentId, 
        text, 
        preferredSenderType: currentSenderTypeRef.current,
        attachmentId,
      })
    }
  }, [socket])

  const markAsRead = useCallback((appointmentId: number) => {
    if (socket?.connected) {
      socket.emit('mark-read', { 
        appointmentId, 
        preferredSenderType: currentSenderTypeRef.current 
      })
    }
  }, [socket])

  const startTyping = useCallback((appointmentId: number) => {
    if (socket?.connected) {
      socket.emit('typing', { 
        appointmentId, 
        preferredSenderType: currentSenderTypeRef.current 
      })
    }
  }, [socket])

  const stopTyping = useCallback((appointmentId: number) => {
    if (socket?.connected) {
      socket.emit('stop-typing', { 
        appointmentId, 
        preferredSenderType: currentSenderTypeRef.current 
      })
    }
  }, [socket])

  // Video call signaling functions
  const initiateCall = useCallback((appointmentId: number, callerPeerId: string, callerName: string, isAudioOnly?: boolean) => {
    console.log('[v0] initiateCall called, socket?.connected:', socket?.connected, 'socket?.id:', socket?.id, 'isAudioOnly:', isAudioOnly)
    if (socket?.connected) {
      console.log('[v0] Emitting call-initiate event to socket server')
      console.log('[v0] Payload:', { appointmentId, callerPeerId, callerName, isAudioOnly })
      socket.emit('call-initiate', { appointmentId, callerPeerId, callerName, isAudioOnly })
      console.log('[v0] call-initiate event emitted successfully')
    } else {
      console.warn('[v0] Cannot initiate call - socket not connected, socket:', socket)
    }
  }, [socket])

  const answerCall = useCallback((appointmentId: number, answerPeerId: string) => {
    if (socket?.connected) {
      console.log('[Socket] Answering call, peerId:', answerPeerId)
      socket.emit('call-answer', { appointmentId, answerPeerId })
    }
  }, [socket])

  const rejectCall = useCallback((appointmentId: number) => {
    if (socket?.connected) {
      socket.emit('call-reject', { appointmentId })
    }
  }, [socket])

  const endCallSignal = useCallback((appointmentId: number) => {
    if (socket?.connected) {
      socket.emit('call-end', { appointmentId })
    }
  }, [socket])
  
  // Register a callback to be called when remote party ends the call
  // Callback can be async - it will be awaited before store is updated
  // Returns unsubscribe function
  const onRemoteCallEnded = useCallback((callback: (appointmentId: number) => void | Promise<void>) => {
    remoteCallEndedCallbacksRef.current.add(callback)
    return () => {
      remoteCallEndedCallbacksRef.current.delete(callback)
    }
  }, [])

  // Consultation management functions
  const startConsultation = useCallback((appointmentId: number) => {
    if (socket?.connected) {
      socket.emit('consultation-start', { appointmentId })
    }
  }, [socket])

  const endConsultation = useCallback((appointmentId: number) => {
    if (socket?.connected) {
      socket.emit('consultation-end', { appointmentId })
    }
  }, [socket])

  const blockChat = useCallback((appointmentId: number) => {
    if (socket?.connected) {
      socket.emit('chat-block', { appointmentId })
    }
  }, [socket])

  const unblockChat = useCallback((appointmentId: number) => {
    if (socket?.connected) {
      socket.emit('chat-unblock', { appointmentId })
    }
  }, [socket])

  const changeConnectionType = useCallback((appointmentId: number, connectionType: 'chat' | 'audio' | 'video') => {
    if (socket?.connected) {
      socket.emit('change-connection-type', { appointmentId, connectionType })
    }
  }, [socket])

  const value: SocketContextValue = {
    socket,
    isConnected,
    joinRoom,
    leaveRoom,
    sendMessage,
    markAsRead,
    startTyping,
    stopTyping,
    initiateCall,
    answerCall,
    rejectCall,
    endCall: endCallSignal,
    onRemoteCallEnded,
    startConsultation,
    endConsultation,
    blockChat,
    unblockChat,
    changeConnectionType,
  }

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  )
}

// Default safe values when outside SocketProvider
const defaultSocketContext: SocketContextValue = {
  socket: null,
  isConnected: false,
  joinRoom: () => {},
  leaveRoom: () => {},
  sendMessage: () => {},
  markAsRead: () => {},
  startTyping: () => {},
  stopTyping: () => {},
  initiateCall: () => {},
  answerCall: () => {},
  rejectCall: () => {},
  endCall: () => {},
  onRemoteCallEnded: () => () => {},
  startConsultation: () => {},
  endConsultation: () => {},
  blockChat: () => {},
  unblockChat: () => {},
  changeConnectionType: () => {},
}

export function useSocket() {
  const context = useContext(SocketContext)
  // Return safe defaults when outside SocketProvider (e.g., during SSR or outside chat)
  if (!context) {
    return defaultSocketContext
  }
  return context
}

// Global socket provider that derives sender type/id from stores
// Use this in root layout to provide socket to VideoCallProvider
export function GlobalSocketProvider({ children }: { children: ReactNode }) {
  const user = useUserStore((state) => state.user)
  const doctor = useDoctorStore((state) => state.doctor)
  
  // Derive sender type and id from stores
  const currentSenderType = doctor ? 'doctor' : user ? 'user' : undefined
  const currentSenderId = doctor?.id ?? user?.id ?? undefined
  
  // Always render SocketProvider to prevent remounting children when user state changes
  // SocketProvider handles undefined sender type/id gracefully via refs
  return (
    <SocketProvider currentSenderType={currentSenderType} currentSenderId={currentSenderId}>
      {children}
    </SocketProvider>
  )
}
