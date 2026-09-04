'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, CheckCheck, Loader2, RotateCcw, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { InboxConversation, InboxMessage } from './types'

interface InboxThreadProps {
  conversation: InboxConversation | null
  messages: InboxMessage[]
  isLoading: boolean
  isSending: boolean
  onReply: (text: string) => Promise<boolean>
  onStatusChange: (status: 'open' | 'closed') => void
  onBack: () => void
}

export function InboxThread({
  conversation,
  messages,
  isLoading,
  isSending,
  onReply,
  onStatusChange,
  onBack,
}: InboxThreadProps) {
  const [text, setText] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Держим прокрутку внизу: оператор смотрит на свежие сообщения, а не на
  // начало переписки.
  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages])

  if (!conversation) {
    return (
      <div className="h-full rounded-xl border border-dashed border-border flex items-center justify-center px-6 text-center">
        <p className="text-sm text-muted-foreground max-w-xs text-pretty">
          Выберите диалог слева, чтобы прочитать обращение и ответить.
        </p>
      </div>
    )
  }

  const submit = async () => {
    const trimmed = text.trim()
    if (!trimmed || isSending) return

    // Поле чистим только при успехе, иначе набранный ответ пропадёт,
    // а восстановить его будет неоткуда.
    const ok = await onReply(trimmed)
    if (ok) setText('')
  }

  return (
    <div className="h-full min-h-0 flex flex-col rounded-xl border border-border bg-card overflow-hidden">
      <div className="shrink-0 border-b border-border px-4 py-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden -ml-2 size-8"
              onClick={onBack}
              aria-label="Назад к списку диалогов"
            >
              <ArrowLeft className="size-4" />
            </Button>
            <p className="truncate text-sm font-semibold text-foreground">
              {conversation.visitorName}
            </p>
          </div>
          {conversation.pageUrl && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground/70">
              Обратился со страницы: {conversation.pageUrl}
            </p>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => onStatusChange(conversation.status === 'open' ? 'closed' : 'open')}
        >
          {conversation.status === 'open' ? (
            <>
              <CheckCheck className="size-4" />
              <span className="hidden sm:inline">Завершить</span>
            </>
          ) : (
            <>
              <RotateCcw className="size-4" />
              <span className="hidden sm:inline">Вернуть в работу</span>
            </>
          )}
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Загружаем переписку</span>
          </div>
        ) : (
          messages.map((message) => {
            const mine = message.sender === 'operator'
            return (
              <div
                key={message.id}
                className={`flex flex-col gap-1 max-w-[85%] ${mine ? 'self-end items-end' : 'self-start items-start'}`}
              >
                <div
                  className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    mine
                      ? 'bg-[var(--teal)] text-[var(--teal-foreground)] rounded-br-sm'
                      : 'bg-muted text-foreground rounded-bl-sm'
                  }`}
                >
                  {message.text}
                </div>
                <time className="text-[11px] text-muted-foreground" dateTime={message.createdAt}>
                  {mine ? 'Вы · ' : ''}
                  {formatTime(message.createdAt)}
                </time>
              </div>
            )
          })
        )}
      </div>

      <div className="shrink-0 border-t border-border p-3 flex items-end gap-2">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            // Enter отправляет, Shift+Enter — перенос строки. Проверка
            // isComposing обязательна: у CJK-раскладок Enter подтверждает
            // набор иероглифа, и без неё ответ ушёл бы недописанным.
            if (
              event.key === 'Enter' &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing &&
              event.keyCode !== 229
            ) {
              event.preventDefault()
              void submit()
            }
          }}
          placeholder="Ответ посетителю… Enter — отправить"
          rows={1}
          maxLength={2000}
          className="min-h-10 max-h-[120px] flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
          onInput={(event) => {
            // Поле растёт под текст до предела, как в чате консультаций.
            const target = event.target as HTMLTextAreaElement
            target.style.height = 'auto'
            target.style.height = `${Math.min(target.scrollHeight, 120)}px`
          }}
          aria-label="Текст ответа"
        />
        <Button
          onClick={() => void submit()}
          disabled={!text.trim() || isSending}
          size="icon"
          className="size-11 shrink-0"
          aria-label="Отправить ответ"
        >
          {isSending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="size-4" aria-hidden="true" />
          )}
        </Button>
      </div>
    </div>
  )
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}
