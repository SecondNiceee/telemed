'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Send, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MessageBubble } from './message-bubble'
import { useSocket } from '@/components/socket-provider'
import { useChatStore } from '@/stores/chat-store'
import type { ApiAppointment } from '@/lib/api/types'
import { cn } from '@/lib/utils'

interface ChatWindowProps {
  appointment: ApiAppointment
  currentSenderType: 'user' | 'doctor'
  currentSenderId: number
  onBack?: () => void
}

export function ChatWindow({
  appointment,
  currentSenderType,
  currentSenderId,
  onBack,
}: ChatWindowProps) {
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isTabVisible, setIsTabVisible] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const { sendMessage, joinRoom, leaveRoom, markAsRead, startTyping, stopTyping, isConnected } = useSocket()
  const { messages, loadMessages, loadingMessages, typingUsers, setActiveChat } = useChatStore()

  const appointmentMessages = messages[appointment.id] || []
  const isLoading = loadingMessages[appointment.id]
  const typingUser = typingUsers[appointment.id]

  // Get the other party name
  const otherPartyName = currentSenderType === 'user' 
    ? appointment.doctorName || 'Врач'
    : appointment.userName || 'Пациент'

  // Track tab visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabVisible(document.visibilityState === 'visible')
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // Join room and load messages on mount - only when appointment changes
  useEffect(() => {
    setActiveChat(appointment.id)
    joinRoom(appointment.id)
    loadMessages(appointment.id)

    return () => {
      leaveRoom(appointment.id)
      setActiveChat(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointment.id])
  
  // Mark as read when chat opens and tab is visible
  useEffect(() => {
    if (isTabVisible) {
      markAsRead(appointment.id)
    }
  }, [appointment.id, isTabVisible, markAsRead])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [appointmentMessages])

  // Mark as read when new messages arrive - ONLY if tab is visible
  useEffect(() => {
    if (appointmentMessages.length > 0 && isTabVisible) {
      markAsRead(appointment.id)
    }
  }, [appointmentMessages.length, appointment.id, markAsRead, isTabVisible])

  // Mark as read when tab becomes visible
  useEffect(() => {
    if (isTabVisible && appointmentMessages.length > 0) {
      markAsRead(appointment.id)
    }
  }, [isTabVisible, appointmentMessages.length, appointment.id, markAsRead])

  const handleTyping = useCallback(() => {
    if (!isTyping) {
      setIsTyping(true)
      startTyping(appointment.id)
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false)
      stopTyping(appointment.id)
    }, 2000)
  }, [isTyping, appointment.id, startTyping, stopTyping])

  const handleSend = () => {
    const text = inputValue.trim()
    if (!text) return

    sendMessage(appointment.id, text)
    setInputValue('')
    setIsTyping(false)
    stopTyping(appointment.id)

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 md:hidden"
            onClick={onBack}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-foreground truncate">{otherPartyName}</h2>
          <p className="text-xs text-muted-foreground">
            {appointment.specialty && <span>{appointment.specialty} • </span>}
            {appointment.date}, {appointment.time}
          </p>
        </div>
        <div className={cn(
          'w-2 h-2 rounded-full shrink-0',
          isConnected ? 'bg-green-500' : 'bg-muted-foreground'
        )} />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : appointmentMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-muted-foreground text-sm">
              Нет сообщений
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              Начните диалог, отправив первое сообщение
            </p>
          </div>
        ) : (
          appointmentMessages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isOwn={message.senderType === currentSenderType && message.senderId === currentSenderId}
            />
          ))
        )}
        
        {/* Typing indicator */}
        {typingUser && typingUser.senderType !== currentSenderType && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span>{otherPartyName} печатает...</span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border bg-card">
        <div className="flex items-center gap-2">
          <Input
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value)
              handleTyping()
            }}
            onKeyDown={handleKeyDown}
            placeholder="Введите сообщение..."
            className="flex-1"
            disabled={!isConnected}
          />
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim() || !isConnected}
            size="icon"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        {!isConnected && (
          <p className="text-xs text-destructive mt-2">
            Нет подключения к серве��у. Переподключение...
          </p>
        )}
      </div>
    </div>
  )
}
