'use client'

import { Check, CheckCheck, FileIcon, Download, X } from 'lucide-react'
import type { ApiMessageAttachment } from '@/lib/api/messages'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

// Simplified message type that works with both full ApiMessage and partial data
interface SimplifiedMessage {
  id: number
  text?: string | null
  attachment?: ApiMessageAttachment | number | null
  createdAt?: string
  read?: boolean
  isSystemMessage?: boolean
}

export type MessageGroupPosition = 'single' | 'first' | 'middle' | 'last'

interface MessageBubbleProps {
  message: SimplifiedMessage
  isOwn: boolean
  groupPosition?: MessageGroupPosition
}

function formatSystemMessageTime(dateString?: string): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  
  const time = date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })

  if (isToday) {
    return `Сегодня, ${time}`
  }

  const dateStr = date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
  })

  return `${dateStr}, ${time}`
}

function SystemMessageBubble({ message }: { message: SimplifiedMessage }) {
  return (
    <div className="flex w-full justify-center my-3">
      <div className="flex flex-col items-center gap-1 w-full max-w-[85%]">
        {message.createdAt && (
          <span className="text-[10px] text-muted-foreground/70">
            {formatSystemMessageTime(message.createdAt)}
          </span>
        )}
        <div className="flex items-center gap-3 w-full">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground px-2 text-center">
            {message.text}
          </span>
          <div className="flex-1 h-px bg-border" />
        </div>
      </div>
    </div>
  )
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
  isOwn,
  imageClassName,
}: {
  attachment: ApiMessageAttachment
  isOwn: boolean
  imageClassName?: string
}) {
  const isImage = isImageMimeType(attachment.mimeType)
  const resolvedUrl = attachment.url

  if (isImage) {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <button
            type="button"
            className="block cursor-zoom-in overflow-hidden text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Открыть изображение ${attachment.filename}`}
          >
            <img
              src={resolvedUrl}
              alt={attachment.filename}
              className={cn('max-h-64 max-w-full object-cover', imageClassName)}
              style={{
                maxWidth: attachment.width && attachment.width > 300 ? 300 : attachment.width,
              }}
            />
          </button>
        </DialogTrigger>
        <DialogContent
          showCloseButton={false}
          overlayClassName="bg-image-viewer-overlay/95"
          className="h-screen max-h-screen w-screen max-w-none border-0 bg-transparent p-4 shadow-none sm:max-w-none"
        >
          <DialogTitle className="sr-only">Просмотр изображения {attachment.filename}</DialogTitle>
          <div className="absolute right-4 top-4 flex items-center gap-2">
            <Button variant="secondary" size="icon" asChild>
              <a href={resolvedUrl} download={attachment.filename} aria-label="Скачать изображение">
                <Download />
              </a>
            </Button>
            <DialogClose asChild>
              <Button variant="secondary" size="icon" aria-label="Закрыть изображение">
                <X />
              </Button>
            </DialogClose>
          </div>
          <div className="flex h-full items-center justify-center pt-12">
            <img
              src={resolvedUrl}
              alt={attachment.filename}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // File attachment
  return (
    <a
      href={resolvedUrl}
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

export function MessageBubble({ message, isOwn, groupPosition = 'single' }: MessageBubbleProps) {
  if (message.isSystemMessage) {
    return <SystemMessageBubble message={message} />
  }

  const attachment = message.attachment && typeof message.attachment === 'object'
    ? message.attachment as ApiMessageAttachment
    : null

  const hasText = Boolean(message.text?.trim())
  const hasAttachment = attachment !== null
  const hasImage = Boolean(attachment && isImageMimeType(attachment.mimeType))
  const showMetadata = groupPosition === 'single' || groupPosition === 'last'

  const groupedRadius = cn(
    'rounded-2xl',
    isOwn && (groupPosition === 'single' || groupPosition === 'last') && 'rounded-br-md',
    !isOwn && (groupPosition === 'single' || groupPosition === 'last') && 'rounded-bl-md',
    isOwn && (groupPosition === 'first' || groupPosition === 'middle') && 'rounded-br-lg',
    !isOwn && (groupPosition === 'first' || groupPosition === 'middle') && 'rounded-bl-lg',
  )

  const metadata = (
    <div className={cn('mt-1 flex items-center gap-1', isOwn ? 'justify-end' : 'justify-start')}>
      <span className={cn('text-[10px]', isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
        {message.createdAt ? formatMessageTime(message.createdAt) : ''}
      </span>
      {isOwn && (
        message.read
          ? <CheckCheck className="size-3 text-primary-foreground/70" />
          : <Check className="size-3 text-primary-foreground/70" />
      )}
    </div>
  )

  return (
    <div className={cn('flex w-full', isOwn ? 'justify-end' : 'justify-start')}>
      {hasAttachment ? (
        <div className="flex max-w-[75%] flex-col">
          <AttachmentPreview
            attachment={attachment}
            isOwn={false}
            imageClassName={hasImage ? groupedRadius : undefined}
          />
          {hasText && (
            <div className={cn('mt-1 px-1', isOwn ? 'text-right' : 'text-left')}>
              <p className="whitespace-pre-wrap break-words text-sm text-foreground">{message.text}</p>
            </div>
          )}
          {showMetadata && (
            <div className={cn('px-1', isOwn && '[&_span]:text-muted-foreground [&_svg]:text-muted-foreground')}>
              {metadata}
            </div>
          )}
        </div>
      ) : (
        <div
          className={cn(
            'max-w-[75%] px-4 py-2.5',
            groupedRadius,
            isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
          )}
        >
          {hasText && <p className="whitespace-pre-wrap break-words text-sm">{message.text}</p>}
          {showMetadata && metadata}
        </div>
      )}
    </div>
  )
}
