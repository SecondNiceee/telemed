'use client'

import { useEffect, useRef, useState } from 'react'
import { MessageCircle, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SupportIntakeForm } from './support-intake-form'
import { useSupportChat } from './use-support-chat'

/**
 * Чат поддержки: кнопка снизу справа, по клику — панель с диалогом.
 *
 * Вопросы уходят в Telegram-группу отдельной темой на каждого посетителя,
 * ответ оператора приходит сюда моментально через сокет.
 */
export function SupportChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  // Сокет поднимаем только после первого открытия и больше не гасим:
  // переподключение на каждое закрытие теряло бы комнату и историю.
  const [hasOpened, setHasOpened] = useState(false)
  const [draft, setDraft] = useState('')

  const { messages, hasConversation, isBusy, isRestoring, error, start, send } =
    useSupportChat(hasOpened)

  const listEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Держим прокрутку у последнего сообщения — иначе ответ оператора
  // появляется ниже видимой области, и его легко не заметить.
  useEffect(() => {
    if (isOpen) listEndRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, isOpen])

  const handleOpen = () => {
    setIsOpen(true)
    setHasOpened(true)
  }

  const handleSend = async () => {
    const text = draft.trim()
    if (text.length === 0 || isBusy) return

    // Черновик очищаем только после подтверждения сервера: при ошибке
    // текст остаётся в поле, и его не приходится набирать заново.
    const sent = await send(text)
    if (sent) {
      setDraft('')
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return
    // Enter в китайском, японском и корейском вводе подтверждает выбор
    // иероглифа, а не отправляет сообщение. keyCode 229 — Safari, где
    // финальное событие композиции приходит ненадёжно.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    event.preventDefault()
    void handleSend()
  }

  return (
    <>
      {/* Кнопка скрывается при открытой панели, чтобы не перекрывать её на
          узких экранах, где панель занимает почти всю ширину. */}
      {!isOpen && (
        <button
          type="button"
          onClick={handleOpen}
          aria-label="Задать вопрос"
          className="fixed bottom-5 right-5 z-50 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <MessageCircle className="size-6" aria-hidden="true" />
        </button>
      )}

      {isOpen && (
        <section
          role="dialog"
          aria-label="Чат поддержки"
          className="fixed bottom-5 right-5 z-50 flex max-h-[min(32rem,calc(100dvh-2.5rem))] w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl sm:w-90"
        >
          <header className="flex shrink-0 items-center justify-between gap-2 bg-primary px-4 py-3 text-primary-foreground">
            <div className="flex flex-col">
              <span className="text-sm font-medium">Поддержка</span>
              <span className="text-xs opacity-80">Отвечаем в рабочее время</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Закрыть чат"
              className="rounded-md p-1 transition-colors hover:bg-primary-foreground/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/50"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </header>

          {isRestoring ? (
            <p className="p-4 text-sm text-muted-foreground">Загружаем переписку…</p>
          ) : hasConversation ? (
            <>
              <div
                className="flex flex-1 flex-col gap-3 overflow-y-auto p-4"
                aria-live="polite"
                aria-atomic="false"
              >
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={
                      message.sender === 'visitor'
                        ? 'max-w-[85%] self-end rounded-xl rounded-br-sm bg-primary px-3 py-2 text-sm leading-relaxed text-primary-foreground'
                        : 'max-w-[85%] self-start rounded-xl rounded-bl-sm bg-secondary px-3 py-2 text-sm leading-relaxed text-secondary-foreground'
                    }
                  >
                    <span className="sr-only">
                      {message.sender === 'visitor' ? 'Вы: ' : 'Поддержка: '}
                    </span>
                    <p className="whitespace-pre-wrap text-pretty">{message.text}</p>
                  </div>
                ))}
                <div ref={listEndRef} />
              </div>

              <div className="shrink-0 border-t border-border p-3">
                {error && (
                  <p role="alert" className="mb-2 text-xs text-destructive">
                    {error}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleKeyDown}
                    maxLength={5000}
                    aria-label="Сообщение"
                    placeholder="Сообщение…"
                    className="h-9 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-base outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm"
                  />
                  <Button
                    type="button"
                    size="icon"
                    onClick={() => void handleSend()}
                    disabled={draft.trim().length === 0 || isBusy}
                    aria-label="Отправить"
                  >
                    <Send className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {error && (
                <p role="alert" className="px-4 pt-4 text-xs text-destructive">
                  {error}
                </p>
              )}
              <SupportIntakeForm isBusy={isBusy} onSubmit={start} />
            </div>
          )}
        </section>
      )}
    </>
  )
}
