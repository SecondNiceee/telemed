'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import { Phone, PhoneOff } from 'lucide-react'
import { io, type Socket } from 'socket.io-client'
import { useChatStore } from '@/stores/chat-store'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { ApiMessage } from '@/lib/api/messages'
import { getSenderType, getSenderId } from '@/lib/api/messages'

type OutgoingCallStatus = 'waiting' | 'answered' | 'rejected'

interface SocketContextValue {
  socket: Socket | null
  isConnected: boolean
  hasConnectionError: boolean
  outgoingCallStatuses: Record<string, OutgoingCallStatus>
  joinRoom: (appointmentId: number) => void
  leaveRoom: (appointmentId: number) => void
  sendMessage: (appointmentId: number, text: string, attachmentId?: number, clientMessageId?: string) => Promise<void>
  markAsRead: (appointmentId: number) => void
  startTyping: (appointmentId: number) => void
  stopTyping: (appointmentId: number) => void
  // Video call signaling
  initiateCall: (appointmentId: number, callerPeerId: string, callerName: string, isAudioOnly?: boolean) => string | null
  answerCall: (appointmentId: number, callId: string, answerPeerId: string) => void
  rejectCall: (appointmentId: number, callId: string) => void
  endCall: (appointmentId: number, callId?: string) => void
  // Callback for when remote party ends call (before store is updated)
  // Callback can be async - socket-provider will await it before updating store
  onRemoteCallEnded: (callback: (appointmentId: number) => void | Promise<void>) => () => void
  // Consultation management
  startConsultation: (appointmentId: number) => void
  endConsultation: (appointmentId: number) => void
  cancelConsultation: (appointmentId: number) => void
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
  const [hasConnectionError, setHasConnectionError] = useState(false)
  const [incomingCall, setIncomingCall] = useState<{ appointmentId: number; callId: string; callerName: string; isAudioOnly: boolean } | null>(null)
  const [outgoingCallStatuses, setOutgoingCallStatuses] = useState<Record<string, OutgoingCallStatus>>({})
  // Use refs for store functions to avoid reconnection on store changes
  const chatStoreRef = useRef(useChatStore.getState())
  
  // Callbacks for remote call ended - allows VideoCallProvider to handle recording before store updates
  // Callbacks can be async - we will await them before updating the store
  const remoteCallEndedCallbacksRef = useRef<Set<(appointmentId: number) => void | Promise<void>>>(new Set())
  
  // Subscribe to store updates via refs (not dependencies)
  useEffect(() => {
    const unsubChat = useChatStore.subscribe((state) => {
      chatStoreRef.current = state
    })
    return unsubChat
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
      setHasConnectionError(false)
    })

    newSocket.on('disconnect', () => {
      console.log('[Socket] Disconnected')
      setIsConnected(false)
    })

    newSocket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message)
      setIsConnected(false)
      setHasConnectionError(true)
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
    newSocket.on('incoming-call', ({ appointmentId, callId, callerName, callerType, isAudioOnly }) => {
      if (callerType !== currentSenderTypeRef.current) {
        setIncomingCall({ appointmentId, callId, callerName, isAudioOnly: Boolean(isAudioOnly) })
        playNotificationSound()
      }
    })

    newSocket.on('call-answered', ({ callId }) => {
      setOutgoingCallStatuses((statuses) => ({ ...statuses, [callId]: 'answered' }))
    })
    newSocket.on('call-rejected', ({ callId }) => {
      setIncomingCall((current) => current?.callId === callId ? null : current)
      setOutgoingCallStatuses((statuses) => ({ ...statuses, [callId]: 'rejected' }))
    })

    newSocket.on('call-ended', async ({ appointmentId, callId }) => {
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
      
      setIncomingCall((current) => !callId || current?.callId === callId ? null : current)
      if (callId) {
        setOutgoingCallStatuses((statuses) => {
          const nextStatuses = { ...statuses }
          delete nextStatuses[callId]
          return nextStatuses
        })
      }
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

    newSocket.on('consultation-cancelled', ({ appointmentId }) => {
      console.log('[Socket] Consultation cancelled:', appointmentId)
      chatStoreRef.current.updateAppointmentStatus(appointmentId, 'cancelled')
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

  const sendMessage = useCallback((appointmentId: number, text: string, attachmentId?: number, clientMessageId = crypto.randomUUID()) => {
    return new Promise<void>((resolve, reject) => {
      if (!socket?.connected) {
        reject(new Error('Нет подключения к серверу'))
        return
      }

      const timer = window.setTimeout(() => reject(new Error('Не удалось отправить сообщение')), 10_000)
      socket.emit('send-message', {
        appointmentId,
        text,
        preferredSenderType: currentSenderTypeRef.current,
        attachmentId,
        clientMessageId,
      }, (result: { success: true } | { success: false; error: string }) => {
        window.clearTimeout(timer)
        if (result?.success) resolve()
        else reject(new Error(result?.error || 'Не удалось отправить сообщение'))
      })
    })
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
    if (!socket?.connected) return null
    const callId = crypto.randomUUID()
    setOutgoingCallStatuses((statuses) => ({ ...statuses, [callId]: 'waiting' }))
    socket.emit('call-initiate', { appointmentId, callId, callerPeerId, callerName, isAudioOnly })
    return callId
  }, [socket])

  const answerCall = useCallback((appointmentId: number, callId: string, answerPeerId: string) => {
    if (socket?.connected) {
      console.log('[Socket] Answering call, peerId:', answerPeerId)
      socket.emit('call-answer', { appointmentId, callId, answerPeerId })
    }
  }, [socket])

  const rejectCall = useCallback((appointmentId: number, callId: string) => {
    if (socket?.connected) {
      socket.emit('call-reject', { appointmentId, callId })
    }
  }, [socket])

  const endCallSignal = useCallback((appointmentId: number, callId?: string) => {
    if (socket?.connected) {
      socket.emit('call-end', { appointmentId, callId })
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

  const cancelConsultation = useCallback((appointmentId: number) => {
    if (socket?.connected) {
      socket.emit('consultation-cancel', { appointmentId })
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
    hasConnectionError,
    outgoingCallStatuses,
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
    cancelConsultation,
    blockChat,
    unblockChat,
    changeConnectionType,
  }

  const acceptIncomingCall = () => {
    if (!incomingCall || !socket?.connected) return
  socket.emit('call-answer', { appointmentId: incomingCall.appointmentId, callId: incomingCall.callId, answerPeerId: '' })
  const target = `/appointment/${incomingCall.appointmentId}/call?callId=${encodeURIComponent(incomingCall.callId)}${incomingCall.isAudioOnly ? '&audio=1' : ''}`
    setIncomingCall(null)
    window.location.assign(target)
  }

  const rejectIncomingCall = () => {
    if (incomingCall && socket?.connected) socket.emit('call-reject', { appointmentId: incomingCall.appointmentId, callId: incomingCall.callId })
    setIncomingCall(null)
  }

  return (
    <SocketContext.Provider value={value}>
      {children}
      <Dialog open={Boolean(incomingCall)} onOpenChange={(open) => { if (!open) rejectIncomingCall() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Входящий {incomingCall?.isAudioOnly ? 'аудиозвонок' : 'видеозвонок'}</DialogTitle>
            <DialogDescription>{incomingCall?.callerName || 'Участник консультации'} приглашает вас в защищённую комнату.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={rejectIncomingCall}><PhoneOff data-icon="inline-start" />Отклонить</Button>
            <Button onClick={acceptIncomingCall}><Phone data-icon="inline-start" />Принять</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SocketContext.Provider>
  )
}

export function useSocket() {
  const context = useContext(SocketContext)
  if (!context) throw new Error('useSocket must be used within SocketProvider')
  return context
}
