import type { Socket } from 'socket.io-client'
import { playNotificationSound } from './notification-sound'
import type { SocketHandlerDeps } from './types'

/**
 * Статус консультации и режим связи: старт, завершение, отмена, блокировка
 * чата и смена типа подключения.
 */
export function registerConsultationHandlers(
  socket: Socket,
  { chatStoreRef, currentSenderTypeRef }: SocketHandlerDeps,
) {
  // Consultation status events
  socket.on('consultation-started', ({ appointmentId, message }) => {
    console.log('[Socket] Consultation started:', appointmentId)
    chatStoreRef.current.updateAppointmentStatus(appointmentId, 'in_progress')

    // Add system message to chat
    if (message) {
      chatStoreRef.current.addMessage(message)
    }
  })

  socket.on('consultation-ended', ({ appointmentId, message }) => {
    console.log('[Socket] Consultation ended:', appointmentId)
    chatStoreRef.current.updateAppointmentStatus(appointmentId, 'completed')

    // Add system message to chat
    if (message) {
      chatStoreRef.current.addMessage(message)
    }
  })

  socket.on('consultation-cancelled', ({ appointmentId }) => {
    console.log('[Socket] Consultation cancelled:', appointmentId)
    chatStoreRef.current.updateAppointmentStatus(appointmentId, 'cancelled')
  })

  socket.on('chat-blocked', ({ appointmentId }) => {
    console.log('[Socket] Chat blocked:', appointmentId)
    chatStoreRef.current.setChatBlocked(appointmentId, true)
  })

  socket.on('chat-unblocked', ({ appointmentId }) => {
    console.log('[Socket] Chat unblocked:', appointmentId)
    chatStoreRef.current.setChatBlocked(appointmentId, false)
  })

  // Connection type change events
  socket.on('connection-type-changed', ({ appointmentId, connectionType, message }) => {
    console.log('[Socket] Connection type changed:', appointmentId, connectionType)
    chatStoreRef.current.setConnectionType(appointmentId, connectionType)

    // Add system message to chat
    if (message) {
      chatStoreRef.current.addMessage(message)
    }

    // Play notification sound for doctors
    if (currentSenderTypeRef.current === 'doctor') {
      playNotificationSound()
    }
  })
}
