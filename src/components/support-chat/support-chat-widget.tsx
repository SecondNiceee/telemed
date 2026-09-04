'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowUp, MessagesSquare, X } from 'lucide-react'
import { useSupportChat } from './use-support-chat'

/**
 * Чат поддержки: кнопка снизу справа, по клику — панель с диалогом.
 *
 * Анонимный: никакой формы перед первым вопросом — ни имени, ни телефона, ни
 * согласия. Персональные данные не собираются, поэтому и согласие не нужно.
 * Вопросы уходят в Telegram-группу отдельной темой на каждого посетителя,
 * ответ оператора приходит сюда моментально через сокет.
 */
export function SupportChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  // Сокет поднимаем только после первого открытия и больше не гасим:
  // переподключение на каждое закрытие теряло бы комнату и историю.
  const [hasOpened, setHasOpened] = useState(false)
  const [draft, setDraft] = useState('')

  const { messages, hasConversation, isBusy, isRestoring, error, send } =
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
          className="fixed bottom-5 right-5 z-50 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/25 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <MessagesSquare className="size-6" aria-hidden="true" />
        </button>
      )}

      {/* Без рамки: панель отделяется от страницы только тенью, как нативный
          мессенджер. Разделителей внутри тоже нет — зоны шапки, ленты и ввода
          различаются отступами и фоном пузырей. */}
      {isOpen && (
        <section
          role="dialog"
          aria-label="Чат поддержки"
          className="fixed bottom-5 right-5 z-50 flex max-h-[min(32rem,calc(100dvh-2.5rem))] w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl bg-card shadow-2xl shadow-black/20 sm:w-90"
        >
          <header className="flex shrink-0 items-center justify-between gap-3 px-5 pt-5 pb-3">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
              >
                <MessagesSquare className="size-4" />
              </span>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-card-foreground">Поддержка</span>
                <span className="text-xs text-muted-foreground">Отвечаем в рабочее время</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Закрыть чат"
              className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </header>

          {isRestoring ? (
            <p className="px-5 pb-5 text-sm text-muted-foreground">Загружаем переписку…</p>
          ) : (
            <>
              <div
                className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-3"
                aria-live="polite"
                aria-atomic="false"
              >
                {/* Приветствие — обычный пузырь оператора, а не отдельный экран:
                    посетитель сразу видит, куда писать. Показываем только пока
                    диалога нет — в восстановленной переписке оно лишнее. */}
                {!hasConversation && (
                  <div className="max-w-[85%] self-start rounded-2xl rounded-bl-md bg-muted px-3.5 py-2.5 text-sm leading-relaxed text-foreground">
                    <p className="text-pretty">
                      Здравствуйте! Напишите вопрос — ответим прямо здесь. Чат анонимный:
                      имя и телефон не нужны.
                    </p>
                    <p className="mt-2 text-xs text-pretty opacity-80">
                      Это не медицинская консультация — вопросы о здоровье задайте врачу на
                      приёме.
                    </p>
                  </div>
                )}
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={
                      message.sender === 'visitor'
                        ? 'max-w-[85%] self-end rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-sm leading-relaxed text-primary-foreground'
                        : 'max-w-[85%] self-start rounded-2xl rounded-bl-md bg-muted px-3.5 py-2.5 text-sm leading-relaxed text-foreground'
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

              <div className="shrink-0 px-3 pb-3 pt-1">
                {error && (
                  <p role="alert" className="mb-2 px-2 text-xs text-destructive">
                    {error}
                  </p>
                )}
                {/* Поле и кнопка в одной «пилюле» на фоне muted: без рамок, как
                    в мессенджерах. Фокус подсвечивает всю пилюлю целиком. */}
                <div className="flex items-center gap-1 rounded-full bg-muted py-1 pl-4 pr-1 transition-[box-shadow] has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring/40">
                  <input
                    ref={inputRef}
                    // Автофокус при открытии: панель появляется по клику, и
                    // посетитель ожидает сразу печатать.
                    autoFocus
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleKeyDown}
                    maxLength={5000}
                    aria-label="Сообщение"
                    placeholder={hasConversation ? 'Сообщение…' : 'Ваш вопрос…'}
                    className="h-8 min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground md:text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={draft.trim().length === 0 || isBusy}
                    aria-label="Отправить"
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-[opacity,transform] hover:scale-105 disabled:scale-100 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <ArrowUp className="size-4" strokeWidth={2.5} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      )}
    </>
  )
}
