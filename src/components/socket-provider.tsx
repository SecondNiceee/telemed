'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useChatStore } from '@/stores/chat-store'
import { IncomingCallDialog } from '@/components/socket/incoming-call-dialog'
import {
  getOutgoingCallStatusesSnapshot,
  setOutgoingCallStatus,
  subscribeToOutgoingCallStatuses,
} from '@/components/socket/outgoing-call-status'
import { registerCallHandlers } from '@/components/socket/register-call-handlers'
import { registerChatHandlers } from '@/components/socket/register-chat-handlers'
import { registerConsultationHandlers } from '@/components/socket/register-consultation-handlers'
import type { IncomingCall, SocketContextValue } from '@/components/socket/types'

// Публичная поверхность не изменилась: потребители по-прежнему берут и хук, и
// тип значения контекста из этого файла.
export type { SocketContextValue } from '@/components/socket/types'

const SocketContext = createContext<SocketContextValue | null>(null)

interface SocketProviderProps {
  children: ReactNode
  currentSenderType?: 'user' | 'doctor'
  currentSenderId?: number
}

export function SocketProvider({ children, currentSenderType, currentSenderId }: SocketProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [hasConnectionError, setHasConnectionError] = useState(false)
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null)
  const outgoingCallStatuses = useSyncExternalStore(
    subscribeToOutgoingCallStatuses,
    getOutgoingCallStatusesSnapshot,
    getOutgoingCallStatusesSnapshot,
  )
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

    let hasConnectedBefore = false

    newSocket.on('connect', () => {
      console.log('[Socket] Connected:', newSocket.id)
      setIsConnected(true)
      setHasConnectionError(false)

      // On the FIRST connect the chat mounts normally (join-room + loadMessages
      // are handled by the chat itself), so nothing to do here.
      if (!hasConnectedBefore) {
        hasConnectedBefore = true
        return
      }

      // Server-side rooms don't survive a reconnect (a new socket id is issued),
      // so re-join the active chat room and silently refetch messages: anything
      // sent by the other party during the offline window would otherwise be
      // lost until reload. refreshMessages does not toggle the loading spinner.
      const activeAppointmentId = chatStoreRef.current.activeAppointmentId
      if (activeAppointmentId !== null) {
        newSocket.emit('join-room', { appointmentId: activeAppointmentId })
        void chatStoreRef.current.refreshMessages(activeAppointmentId)
      }
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

    // Handle errors
    newSocket.on('error', ({ message }) => {
      console.error('[Socket] Error:', message)
    })

    // Предметные обработчики разнесены по темам - см. src/components/socket/.
    // Здесь остаётся только то, что относится к самому соединению.
    const handlerDeps = { chatStoreRef, currentSenderTypeRef, currentSenderIdRef }
    registerChatHandlers(newSocket, handlerDeps)
    registerCallHandlers(newSocket, { ...handlerDeps, setIncomingCall, remoteCallEndedCallbacksRef })
    registerConsultationHandlers(newSocket, handlerDeps)

    setSocket(newSocket)

    return () => {
      newSocket.disconnect()
    }
  // Empty dependency array - socket should only connect once when the component mounts
  // All store updates are handled via refs to avoid reconnection
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
    setOutgoingCallStatus(callId, 'waiting')
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

  // Спрашивает сервер, «звонит» ли приглашение до сих пор. Нужно звонящему
  // после перезагрузки страницы: локальный outgoingCallStatuses тогда пуст, и
  // без этого запроса нельзя отличить неотвеченный звонок от давно закрытого.
  // null - ответа нет (нет сокета или таймаут), решение принимает вызывающий.
  const getCallState = useCallback((appointmentId: number, callId: string) => {
    return new Promise<{ pending: boolean } | null>((resolve) => {
      if (!socket?.connected) {
        resolve(null)
        return
      }
      let settled = false
      const finish = (result: { pending: boolean } | null) => {
        if (settled) return
        settled = true
        window.clearTimeout(timer)
        resolve(result)
      }
      const timer = window.setTimeout(() => finish(null), 5000)
      socket.emit('call-state', { appointmentId, callId }, (response: { pending?: boolean } | undefined) => {
        finish(typeof response?.pending === 'boolean' ? { pending: response.pending } : null)
      })
    })
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
    getCallState,
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
      <IncomingCallDialog
        incomingCall={incomingCall}
        onAccept={acceptIncomingCall}
        onReject={rejectIncomingCall}
      />
    </SocketContext.Provider>
  )
}

export function useSocket() {
  const context = useContext(SocketContext)
  if (!context) throw new Error('useSocket must be used within SocketProvider')
  return context
}
