'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Inbox, Wifi, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { primeChime } from './inbox-notify'
import { useOperatorInbox } from './use-operator-inbox'
import { InboxConversationList } from './inbox-conversation-list'
import { InboxThread } from './inbox-thread'
import type { InboxConversation } from './types'
import type { AdminUser } from '../types'

interface AdminInboxScreenProps {
  admin: AdminUser
  initialConversations: InboxConversation[]
}

export function AdminInboxScreen({ admin, initialConversations }: AdminInboxScreenProps) {
  const {
    conversations,
    openConversation,
    messages,
    unreadCount,
    isConnected,
    isLoadingThread,
    isSending,
    error,
    open,
    reply,
    setStatus,
  } = useOperatorInbox(initialConversations)

  // На узком экране список и переписка не помещаются рядом, поэтому
  // показываем что-то одно: выбрал диалог — видишь переписку.
  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list')

  /**
   * Разрешение на звук.
   *
   * Браузер не даст воспроизвести сигнал до первого действия пользователя,
   * поэтому готовим аудиоконтекст на первый же клик или клавишу в инбоксе.
   */
  useEffect(() => {
    const onFirstInteraction = () => primeChime()
    window.addEventListener('pointerdown', onFirstInteraction, { once: true })
    window.addEventListener('keydown', onFirstInteraction, { once: true })
    return () => {
      window.removeEventListener('pointerdown', onFirstInteraction)
      window.removeEventListener('keydown', onFirstInteraction)
    }
  }, [])

  const handleSelect = (publicId: string) => {
    open(publicId)
    setMobileView('thread')
  }

  return (
    <main className="min-h-screen bg-background flex flex-col">
      <header className="bg-[var(--surface-dark)] text-primary-foreground shrink-0">
        <div className="mx-auto max-w-6xl px-6 py-5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-lg font-semibold tracking-tight">smartcardio</p>
            <p className="text-xs text-primary-foreground/60">
              Обращения с сайта
              {unreadCount > 0 && ` · ${unreadCount} непрочитанных`}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div
              className="flex items-center gap-2 text-xs text-primary-foreground/60"
              aria-live="polite"
            >
              {isConnected ? (
                <>
                  <Wifi className="size-4 text-[var(--teal-on-dark)]" aria-hidden="true" />
                  <span className="hidden sm:inline">На связи</span>
                </>
              ) : (
                <>
                  <WifiOff className="size-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Нет связи</span>
                </>
              )}
            </div>
            <div className="hidden md:block text-right">
              <p className="text-sm font-medium">{admin.name || 'Администратор'}</p>
              <p className="text-xs text-primary-foreground/60">{admin.email}</p>
            </div>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10"
            >
              <Link href="/admin">
                <ArrowLeft className="size-4" />
                <span className="hidden sm:inline">К организациям</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="shrink-0 border-b border-destructive/30 bg-destructive/10 px-6 py-3"
        >
          <p className="mx-auto max-w-6xl text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-6 min-h-0">
        {conversations.length === 0 ? (
          <div className="h-full rounded-xl border border-dashed border-border px-6 py-16 flex flex-col items-center justify-center text-center gap-3">
            <Inbox className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground max-w-xs text-pretty">
              Пока никто не обращался. Новые вопросы с сайта появятся здесь сразу — со
              звуковым сигналом.
            </p>
          </div>
        ) : (
          <div className="h-full flex gap-6 min-h-0">
            <div
              className={`${
                mobileView === 'list' ? 'flex' : 'hidden'
              } lg:flex w-full lg:w-80 shrink-0 flex-col min-h-0`}
            >
              <InboxConversationList
                conversations={conversations}
                openId={openConversation?.publicId ?? null}
                onSelect={handleSelect}
              />
            </div>

            <div
              className={`${
                mobileView === 'thread' ? 'flex' : 'hidden'
              } lg:flex flex-1 flex-col min-h-0`}
            >
              <InboxThread
                conversation={openConversation}
                messages={messages}
                isLoading={isLoadingThread}
                isSending={isSending}
                onReply={reply}
                onStatusChange={(status) => {
                  if (openConversation) setStatus(openConversation.publicId, status)
                }}
                onBack={() => setMobileView('list')}
              />
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
