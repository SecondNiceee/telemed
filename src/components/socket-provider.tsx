'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
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
}

export function SocketProvider({ children }: SocketProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const { addMessage, setTypingUser, incrementUnreadCount, activeAppointmentId } = useChatStore()

  useEffect(() => {
    // Get the base URL for socket connection
    const socketUrl = typeof window !== 'undefined' 
      ? window.location.origin 
      : process.env.SERVER_URL || 'http://localhost:3000'

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
      
      // Increment unread count if not in the active chat
      const msgAppointmentId = typeof message.appointment === 'object' 
        ? message.appointment.id 
        : message.appointment
      
      if (activeAppointmentId !== msgAppointmentId) {
        incrementUnreadCount(msgAppointmentId)
      }
    })

    // Handle typing indicators
    newSocket.on('user-typing', ({ appointmentId, senderType, senderId }) => {
      setTypingUser(appointmentId, { senderType, senderId })
    })

    newSocket.on('user-stop-typing', ({ appointmentId }) => {
      setTypingUser(appointmentId, null)
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
      socket.emit('send-message', { appointmentId, text })
    }
  }, [socket])

  const markAsRead = useCallback((appointmentId: number) => {
    if (socket?.connected) {
      socket.emit('mark-read', { appointmentId })
    }
  }, [socket])

  const startTyping = useCallback((appointmentId: number) => {
    if (socket?.connected) {
      socket.emit('typing', { appointmentId })
    }
  }, [socket])

  const stopTyping = useCallback((appointmentId: number) => {
    if (socket?.connected) {
      socket.emit('stop-typing', { appointmentId })
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
