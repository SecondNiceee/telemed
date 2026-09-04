'use client'

import type { InboxConversation } from './types'
import { isUnread } from './types'

interface InboxConversationListProps {
  conversations: InboxConversation[]
  openId: string | null
  onSelect: (publicId: string) => void
}

export function InboxConversationList({
  conversations,
  openId,
  onSelect,
}: InboxConversationListProps) {
  return (
    <div className="flex flex-col min-h-0 rounded-xl border border-border bg-card overflow-hidden">
      <p className="shrink-0 border-b border-border px-4 py-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Диалоги
      </p>

      {/* role=listbox: список работает как выбор одного элемента, стрелки и
          screen reader тогда ведут себя предсказуемо. */}
      <ul className="flex-1 overflow-y-auto divide-y divide-border" role="listbox">
        {conversations.map((conversation) => {
          const selected = conversation.publicId === openId
          const unread = isUnread(conversation)

          return (
            <li key={conversation.publicId} role="none">
              <button
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => onSelect(conversation.publicId)}
                className={`w-full px-4 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${
                  selected ? 'bg-muted' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  {/* Точка непрочитанного: цветом не ограничиваемся — рядом
                      есть текстовая подпись для screen reader. */}
                  {unread && (
                    <span
                      className="size-2 shrink-0 rounded-full bg-[var(--teal)]"
                      aria-hidden="true"
                    />
                  )}
                  <p
                    className={`min-w-0 flex-1 truncate text-sm ${
                      unread ? 'font-semibold text-foreground' : 'font-medium text-foreground'
                    }`}
                  >
                    {conversation.visitorName}
                  </p>
                  {unread && <span className="sr-only">непрочитанное</span>}
                  <time
                    className="shrink-0 text-xs text-muted-foreground"
                    dateTime={conversation.lastMessageAt ?? conversation.createdAt}
                  >
                    {formatWhen(conversation.lastMessageAt ?? conversation.createdAt)}
                  </time>
                </div>

                {conversation.lastMessagePreview && (
                  <p className="mt-1.5 truncate text-xs text-muted-foreground">
                    {conversation.lastMessageSender === 'operator' && (
                      <span className="text-muted-foreground/70">Вы: </span>
                    )}
                    {conversation.lastMessagePreview}
                  </p>
                )}

                {conversation.status === 'closed' && (
                  <p className="mt-1.5 text-xs text-muted-foreground/70">Завершён</p>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * Короткая метка времени для списка.
 *
 * Сегодняшнее — время, вчерашнее — «вчера», остальное — дата. В списке важна
 * компактность: полная дата съедает строку и мешает читать имена.
 */
function formatWhen(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''

  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  if (sameDay) {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  }

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return 'вчера'

  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}
