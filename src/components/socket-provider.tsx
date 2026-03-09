'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useChatStore } from '@/stores/chat-store'
import type { ApiMessage } from '@/lib/api/messages'

interface SocketContextValue {
  socket: Socket | null
  isConnected: boolean
  joinRoom: (appointmentId: number) => void
  leaveRoom: (appointmentId: number) => void
  sendMessage: (appointmentId: number, text: string) => void
  markAsRead: (appointmentId: number) => void
  startTyping: (appointmentId: number) => void
  stopTyping: (appointmentId: number) => void
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
  const { addMessage, setTypingUser, incrementUnreadCount, activeAppointmentId, markMessagesAsReadByType } = useChatStore()
  
  // Track current sender info in refs to use in socket event handlers
  const currentSenderTypeRef = useRef(currentSenderType)
  const currentSenderIdRef = useRef(currentSenderId)
  
  useEffect(() => {
    currentSenderTypeRef.current = currentSenderType
    currentSenderIdRef.current = currentSenderId
  }, [currentSenderType, currentSenderId])

  useEffect(() => {
    // Connect to the separate Socket.io server on port 3001
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001'

    const newSocket = io(socketUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      autoConnect: true,
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
      addMessage(message)
      
      const msgAppointmentId = typeof message.appointment === 'object' 
        ? message.appointment.id 
        : message.appointment
      
      // Check if this is a message from the other party (not from us)
      const isOwnMessage = message.senderType === currentSenderTypeRef.current && 
                           message.senderId === currentSenderIdRef.current
      
      // Play sound and increment unread if:
      // 1. Not our own message AND
      // 2. Either not in active chat OR tab is not visible
      if (!isOwnMessage) {
        const isTabVisible = document.visibilityState === 'visible'
        const isInActiveChat = activeAppointmentId === msgAppointmentId
        
        if (!isInActiveChat || !isTabVisible) {
          incrementUnreadCount(msgAppointmentId)
          // Play notification sound if tab is not visible
          if (!isTabVisible) {
            playNotificationSound()
          }
        }
      }
    })

    // Handle typing indicators
    newSocket.on('user-typing', ({ appointmentId, senderType, senderId }) => {
      setTypingUser(appointmentId, { senderType, senderId })
    })

    newSocket.on('user-stop-typing', ({ appointmentId }) => {
      setTypingUser(appointmentId, null)
    })

    // Handle messages marked as read
    newSocket.on('messages-read', ({ appointmentId, readBy }) => {
      // Mark messages from the OTHER party as read
      // If readBy is 'user', mark all 'doctor' messages as read (user read them)
      // If readBy is 'doctor', mark all 'user' messages as read (doctor read them)
      const senderTypeToMarkRead = readBy === 'user' ? 'doctor' : 'user'
      markMessagesAsReadByType(appointmentId, senderTypeToMarkRead)
    })

    // Handle errors
    newSocket.on('error', ({ message }) => {
      console.error('[Socket] Error:', message)
    })

    setSocket(newSocket)

    return () => {
      newSocket.disconnect()
    }
  }, [addMessage, setTypingUser, incrementUnreadCount, activeAppointmentId])

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

  const sendMessage = useCallback((appointmentId: number, text: string) => {
    if (socket?.connected) {
      socket.emit('send-message', { 
        appointmentId, 
        text, 
        preferredSenderType: currentSenderTypeRef.current 
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

  const value: SocketContextValue = {
    socket,
    isConnected,
    joinRoom,
    leaveRoom,
    sendMessage,
    markAsRead,
    startTyping,
    stopTyping,
  }

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}
