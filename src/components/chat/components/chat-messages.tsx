'use client'

import { useEffect, useRef } from 'react'
import { Video } from 'lucide-react'
import { MessageBubble } from '../message-bubble'
import type { ChatMessagesProps } from '../types'

// Local helper to get sender type from message with polymorphic sender relation
function getMessageSenderType(message: ChatMessagesProps['messages'][number]): 'user' | 'doctor' | null {
  if (!message.sender || !message.sender.relationTo) {
    return null
  }
  return message.sender.relationTo === 'users' ? 'user' : 'doctor'
}

// Local helper to get sender ID from message with polymorphic sender relation
function getMessageSenderId(message: ChatMessagesProps['messages'][number]): number | null {
  if (!message.sender || message.sender.value === undefined) {
    return null
  }
  return typeof message.sender.value === 'object' 
    ? message.sender.value.id 
    : message.sender.value
}

export function ChatMessages({
  messages,
  currentSenderType,
  currentSenderId,
  otherPartyName,
  isLoading,
  typingUser,
  recording,
}: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <p className="text-muted-foreground text-sm">
            Нет сообщений
          </p>
          <p className="text-muted-foreground text-xs mt-1">
            Начните диалог, отправив первое сообщение
          </p>
        </div>
      ) : (
        messages.map((message) => {
          // System messages don't have a sender
          if (message.isSystemMessage) {
            return (
              <MessageBubble
                key={message.id}
                message={message}
                isOwn={false}
              />
            )
          }
          const senderType = getMessageSenderType(message)
          const senderId = getMessageSenderId(message)
          const isOwn = senderType === currentSenderType && senderId === currentSenderId
          return (
            <MessageBubble
              key={message.id}
              message={message}
              isOwn={isOwn}
            />
          )
        })
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
      
      {/* Recording display */}
      {recording && typeof recording === 'object' && recording.url && (
        <div className="my-4 p-4 rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 mb-3 text-sm font-medium text-foreground">
            <Video className="w-4 h-4 text-primary" />
            <span>Запись консультации</span>
          </div>
          <video
            src={recording.url}
            controls
            className="w-full max-h-80 rounded-lg bg-black"
          >
            Ваш браузер не поддерживает воспроизведение видео
          </video>
        </div>
      )}
      
      <div ref={messagesEndRef} />
    </div>
  )
}
