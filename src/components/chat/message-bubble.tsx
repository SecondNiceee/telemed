'use client'

import { Check, CheckCheck } from 'lucide-react'
import type { ApiMessage } from '@/lib/api/messages'
import { cn } from '@/lib/utils'

interface MessageBubbleProps {
  message: ApiMessage
  isOwn: boolean
}

function formatMessageTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  
  const time = date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })

  if (isToday) {
    return time
  }

  const dateStr = date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  })

  return `${dateStr}, ${time}`
}

export function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  return (
    <div
      className={cn(
        'flex w-full',
        isOwn ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-4 py-2.5',
          isOwn
            ? 'bg-primary text-primary-foreground rounded-br-md'
            : 'bg-muted text-foreground rounded-bl-md'
        )}
      >
        <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
        <div
          className={cn(
            'flex items-center gap-1 mt-1',
            isOwn ? 'justify-end' : 'justify-start'
          )}
        >
          <span
            className={cn(
              'text-[10px]',
              isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
            )}
          >
            {formatMessageTime(message.createdAt)}
          </span>
          {isOwn && (
            message.read ? (
              <CheckCheck className={cn('w-3 h-3', 'text-primary-foreground/70')} />
            ) : (
              <Check className={cn('w-3 h-3', 'text-primary-foreground/70')} />
            )
          )}
        </div>
      </div>
    </div>
  )
}
