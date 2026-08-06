'use client'

import { useEffect, useState } from 'react'
import { MessageSquare, User as UserIcon } from 'lucide-react'
import type { ApiAppointment } from '@/lib/api/types'
import { useChatStore } from '@/stores/chat-store'
import { MessagesApi, type ApiMessage, getSenderType } from '@/lib/api/messages'
import { cn } from '@/lib/utils'
import { formatDateShort } from '@/lib/utils/date'

interface ChatSidebarProps {
  appointments: ApiAppointment[]
  selectedAppointmentId: number | null
  onSelectAppointment: (appointment: ApiAppointment) => void
  currentSenderType: 'user' | 'doctor'
}

interface AppointmentWithLastMessage extends ApiAppointment {
  lastMessage?: ApiMessage | null
}

function formatLastMessageTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'сейчас'
  if (diffMins < 60) return `${diffMins} мин`
  if (diffHours < 24) return `${diffHours} ч`
  if (diffDays < 7) return `${diffDays} д`
  
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

export function ChatSidebar({
  appointments,
  selectedAppointmentId,
  onSelectAppointment,
  currentSenderType,
}: ChatSidebarProps) {
  const { unreadCounts } = useChatStore() // Тут я беру из store unreadCounts, там это Reacord<number, number>
  const [lastMessages, setLastMessages] = useState<Record<number, ApiMessage | null>>({}) // Последне сообщения, просто обычный useState
  const [loading, setLoading] = useState(true)

  // Загружаю последние сообщени
  useEffect(() => {
    async function loadLastMessages() {
      setLoading(true)
      const results: Record<number, ApiMessage | null> = {}
      
      await Promise.all(
        appointments.map(async (appt) => {
          try {
            const lastMsg = await MessagesApi.getLastMessage(appt.id)
            results[appt.id] = lastMsg
          } catch {
            results[appt.id] = null
          }
        })
      )
      setLastMessages(results)
      setLoading(false)
    }

    if (appointments.length > 0) {
      loadLastMessages()
    } else {
      setLoading(false)
    }
  }, [appointments])

  // Когда приходит новое сообщение, обновлюя тему теорему
  const { messages } = useChatStore()
  useEffect(() => {
    const newLastMessages = { ...lastMessages }
    let hasChanges = false

    for (const apptId of Object.keys(messages)) {
      const apptMessages = messages[Number(apptId)]
      if (apptMessages && apptMessages.length > 0) {
        const lastMsg = apptMessages[apptMessages.length - 1]
        if (!newLastMessages[Number(apptId)] || lastMsg.id !== newLastMessages[Number(apptId)]?.id) {
          newLastMessages[Number(apptId)] = lastMsg
          hasChanges = true
        }
      }
    }

    if (hasChanges) {
      setLastMessages(newLastMessages)
    }
  }, [messages])

  // Всегда сортировка по приходу нового сообщения
  const sortedAppointments = [...appointments].sort((a, b) => {
    const lastA = lastMessages[a.id]
    const lastB = lastMessages[b.id]
    
    if (!lastA && !lastB) return 0
    if (!lastA) return 1
    if (!lastB) return -1
    
    return new Date(lastB.createdAt).getTime() - new Date(lastA.createdAt).getTime()
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  if (appointments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
          <MessageSquare className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">Нет диалогов</p>
        <p className="text-xs text-muted-foreground mt-1">
          Диалоги появятся после записи на консультацию
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold text-foreground">Сообщения</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {appointments.length} {appointments.length === 1 ? 'диалог' : 'диалогов'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sortedAppointments.map((appointment) => {
          const isSelected = selectedAppointmentId === appointment.id
          const unreadCount = unreadCounts[appointment.id] || 0
          const lastMessage = lastMessages[appointment.id]
          
          const otherPartyName = currentSenderType === 'user'
            ? appointment.doctorName || 'Врач'
            : appointment.userName || 'Пациент'

          return (
            <button
              key={appointment.id}
              onClick={() => onSelectAppointment(appointment)}
              className={cn(
                'w-full flex items-start gap-3 p-4 text-left transition-colors border-b border-border',
                isSelected
                  ? 'bg-primary/5 border-l-2 border-l-primary'
                  : 'hover:bg-muted/50'
              )}
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <UserIcon className="w-5 h-5 text-primary" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground truncate text-sm">
                    {otherPartyName}
                  </span>
                  {lastMessage && (
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatLastMessageTime(lastMessage.createdAt)}
                    </span>
                  )}
                </div>
                
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {appointment.specialty && `${appointment.specialty} • `}
                  {formatDateShort(appointment.date)}
                </p>

                {lastMessage && (
                  <p className={cn(
                    'text-xs truncate mt-1',
                    unreadCount > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'
                  )}>
                    {lastMessage.sender && getSenderType(lastMessage) === currentSenderType && 'Вы: '}
                    {lastMessage.text}
                  </p>
                )}
              </div>

              {/* Unread badge */}
              {unreadCount > 0 && (
                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-primary-foreground">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
