'use client'

import { Check, CheckCheck, FileIcon, Download } from 'lucide-react'
import type { ApiMessage, ApiMessageAttachment } from '@/lib/api/messages'
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isImageMimeType(mimeType?: string): boolean {
  return mimeType?.startsWith('image/') ?? false
}

function AttachmentPreview({ 
  attachment, 
  isOwn 
}: { 
  attachment: ApiMessageAttachment
  isOwn: boolean 
}) {
  const isImage = isImageMimeType(attachment.mimeType)

  if (isImage) {
    return (
      <a 
        href={attachment.url} 
        target="_blank" 
        rel="noopener noreferrer"
        className="block"
      >
        <img
          src={attachment.url}
          alt={attachment.filename}
          className="max-w-full rounded-lg max-h-64 object-cover"
          style={{
            maxWidth: attachment.width && attachment.width > 300 ? 300 : attachment.width,
          }}
        />
      </a>
    )
  }

  // File attachment
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'flex items-center gap-3 p-2 rounded-lg transition-colors',
        isOwn 
          ? 'bg-primary-foreground/10 hover:bg-primary-foreground/20' 
          : 'bg-background/50 hover:bg-background/80'
      )}
    >
      <div className={cn(
        'w-10 h-10 rounded flex items-center justify-center',
        isOwn ? 'bg-primary-foreground/20' : 'bg-muted'
      )}>
        <FileIcon className={cn(
          'w-5 h-5',
          isOwn ? 'text-primary-foreground' : 'text-muted-foreground'
        )} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm truncate',
          isOwn ? 'text-primary-foreground' : 'text-foreground'
        )}>
          {attachment.filename}
        </p>
        <p className={cn(
          'text-xs',
          isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
        )}>
          {formatFileSize(attachment.filesize)}
        </p>
      </div>
      <Download className={cn(
        'w-4 h-4 shrink-0',
        isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
      )} />
    </a>
  )
}

export function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  // Parse attachment - can be object or number (ID only)
  const attachment = message.attachment && typeof message.attachment === 'object' 
    ? message.attachment as ApiMessageAttachment
    : null

  const hasText = message.text && message.text.trim().length > 0
  const hasAttachment = attachment !== null

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
        {/* Attachment */}
        {hasAttachment && (
          <div className={cn(hasText && 'mb-2')}>
            <AttachmentPreview attachment={attachment} isOwn={isOwn} />
          </div>
        )}
        
        {/* Text */}
        {hasText && (
          <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
        )}
        
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
