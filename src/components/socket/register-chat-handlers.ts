import type { Socket } from 'socket.io-client'
import { toast } from 'sonner'
import type { ApiMessage } from '@/lib/api/messages'
import { getSenderType, getSenderId } from '@/lib/api/messages'
import { isInCallRoom } from '@/lib/chat/call-chat-bridge'
import { playNotificationSound } from './notification-sound'
import type { SocketHandlerDeps } from './types'

/**
 * События чата: сообщения, тосты-уведомления, индикатор набора, прочтения.
 */
export function registerChatHandlers(
  socket: Socket,
  { chatStoreRef, currentSenderTypeRef, currentSenderIdRef }: SocketHandlerDeps,
) {
  // Handle new messages
  socket.on('new-message', (message: ApiMessage) => {
    chatStoreRef.current.addMessage(message)

    const msgAppointmentId = typeof message.appointment === 'object'
      ? message.appointment.id
      : message.appointment

    // Check if this is a message from the other party (not from us)
    const messageSenderType = getSenderType(message)
    const messageSenderId = getSenderId(message)
    // isOwnMessage только если можем определить тип и он совпадает
    const isOwnMessage = messageSenderType !== null &&
                         messageSenderType === currentSenderTypeRef.current &&
                         messageSenderId === currentSenderIdRef.current

    // Play sound and increment unread if:
    // 1. Not our own message AND
    // 2. Either not in active chat OR tab is not visible
    if (!isOwnMessage) {
      const isTabVisible = document.visibilityState === 'visible'
      const isInActiveChat = chatStoreRef.current.activeAppointmentId === msgAppointmentId

      if (!isInActiveChat || !isTabVisible) {
        chatStoreRef.current.incrementUnreadCount(msgAppointmentId)
        // Play notification sound if tab is not visible
        if (!isTabVisible) {
          playNotificationSound()
        }
      }
    }
  })

  // Глобальное уведомление о новом сообщении: приходит в персональную
  // комнату получателя на любой странице сайта. Показываем тост справа
  // снизу с кнопкой перехода в нужный чат.
  socket.on('message-notification', ({ messageId, appointmentId, recipientType, senderName, text }: {
    messageId: number
    appointmentId: number
    recipientType: 'user' | 'doctor'
    senderName: string
    text: string
  }) => {
    // Не показываем тост, если этот чат уже открыт и вкладка видима.
    const isTabVisible = document.visibilityState === 'visible'
    const isInActiveChat = chatStoreRef.current.activeAppointmentId === appointmentId
    if (isInActiveChat && isTabVisible) return

    // В звонке по этой же консультации тост не показываем вообще: единственное
    // его действие - переход на страницу чата, а это полная перезагрузка,
    // которая выбрасывает человека из комнаты посреди разговора. Сообщение не
    // теряется: чат доступен прямо в звонке (панель справа), а на кнопке чата
    // горит счётчик непрочитанных.
    if (isInCallRoom(appointmentId)) return

    const chatUrl = recipientType === 'doctor'
      ? `/lk-med/chat?appointment=${appointmentId}`
      : `/lk/chat?appointment=${appointmentId}`

    // id тоста = id сообщения: если на странице смонтировано два
    // SocketProvider (глобальный + чат), дубликат не появится.
    toast(senderName, {
      id: `msg-${messageId}`,
      description: text,
      position: 'bottom-right',
      duration: 8000,
      action: {
        label: 'Перейти',
        onClick: () => window.location.assign(chatUrl),
      },
    })
  })

  // Handle typing indicators
  socket.on('user-typing', ({ appointmentId, senderType, senderId }) => {
    chatStoreRef.current.setTypingUser(appointmentId, { senderType, senderId })
  })

  socket.on('user-stop-typing', ({ appointmentId }) => {
    chatStoreRef.current.setTypingUser(appointmentId, null)
  })

  // Handle messages marked as read
  socket.on('messages-read', ({ appointmentId, readBy }) => {
    // Mark messages from the OTHER party as read
    // If readBy is 'user', mark all 'doctor' messages as read (user read them)
    // If readBy is 'doctor', mark all 'user' messages as read (doctor read them)
    const senderTypeToMarkRead = readBy === 'user' ? 'doctor' : 'user'
    chatStoreRef.current.markMessagesAsReadByType(appointmentId, senderTypeToMarkRead)
  })
}
