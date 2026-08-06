import type { Server as SocketIOServer } from 'socket.io'
import type { Payload } from 'payload'
import type { 
  AuthenticatedSocket, 
  ConsultationStartPayload, 
  ConsultationEndPayload,
  ChatBlockPayload,
  ChatUnblockPayload,
  ChangeConnectionTypePayload,
} from '../types'
import isValidAppointmentId from '../utils/isValidAppointmentId'
import verifyAppointmentAccess from '../utils/verifyAppointmentAccess'

/**
 * Handle consultation start event
 * Only doctors can start consultations
 */
export function createConsultationStartHandler(io: SocketIOServer, payload: Payload) {
  return async (socket: AuthenticatedSocket, data: ConsultationStartPayload) => {
    const { appointmentId } = data
    const { senderType, senderId } = socket.data

    // Only doctors can start consultations
    if (senderType !== 'doctor') {
      socket.emit('error', { message: 'Only doctors can start consultations' })
      return
    }

    if (!isValidAppointmentId(appointmentId)) {
      socket.emit('error', { message: 'Invalid appointment ID' })
      return
    }

    // Verify the doctor has access to this appointment
    const accessResult = await verifyAppointmentAccess(payload, appointmentId, undefined, senderId)
    if (!accessResult.hasAccess) {
      socket.emit('error', { message: 'Access denied to this appointment' })
      return
    }

    try {
      // Get current appointment to check if consultation is already in progress
      const appointment = await payload.findByID({
        collection: 'appointments',
        id: appointmentId,
        overrideAccess: true,
      })

      // If consultation is already in progress, just emit status update without creating a new message
      if (appointment.status === 'in_progress') {
        console.log(`[Socket] Consultation already in progress for appointment ${appointmentId}, skipping system message`)
        const room = `appointment:${appointmentId}`
        io.to(room).emit('consultation-started', { 
          appointmentId,
          message: null, // No new message, consultation was already started
        })
        return
      }

      // Update appointment status to in_progress
      await payload.update({
        collection: 'appointments',
        id: appointmentId,
        data: { status: 'in_progress' },
        overrideAccess: true,
      })

      // Create system message for consultation start (only if not already in_progress)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const systemMessage = await (payload.create as any)({
        collection: 'messages',
        data: {
          appointment: appointmentId,
          text: 'Врач начал консультацию',
          isSystemMessage: true,
          read: false,
        },
        overrideAccess: true,
      })

      // Emit to all clients in the room
      const room = `appointment:${appointmentId}`
      io.to(room).emit('consultation-started', { 
        appointmentId,
        message: systemMessage,
      })
      
      console.log(`[Socket] Consultation started for appointment ${appointmentId} by doctor ${senderId}`)
    } catch (error) {
      console.error('[Socket] Failed to start consultation:', error)
      socket.emit('error', { message: 'Failed to start consultation' })
    }
  }
}

/**
 * Handle consultation end event
 * Only doctors can end consultations
 */
export function createConsultationEndHandler(io: SocketIOServer, payload: Payload) {
  return async (socket: AuthenticatedSocket, data: ConsultationEndPayload) => {
    const { appointmentId } = data
    const { senderType, senderId } = socket.data

    // Only doctors can end consultations
    if (senderType !== 'doctor') {
      socket.emit('error', { message: 'Only doctors can end consultations' })
      return
    }

    if (!isValidAppointmentId(appointmentId)) {
      socket.emit('error', { message: 'Invalid appointment ID' })
      return
    }

    // Verify the doctor has access to this appointment
    const accessResult = await verifyAppointmentAccess(payload, appointmentId, undefined, senderId)
    if (!accessResult.hasAccess) {
      socket.emit('error', { message: 'Access denied to this appointment' })
      return
    }

    try {
      // Update appointment status to completed
      await payload.update({
        collection: 'appointments',
        id: appointmentId,
        data: { status: 'completed' },
        overrideAccess: true,
      })

      // Create system message for consultation end
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const systemMessage = await (payload.create as any)({
        collection: 'messages',
        data: {
          appointment: appointmentId,
          text: 'Врач завершил консультацию',
          isSystemMessage: true,
          read: false,
        },
        overrideAccess: true,
      })

      // Emit to all clients in the room
      const room = `appointment:${appointmentId}`
      io.to(room).emit('consultation-ended', { 
        appointmentId,
        message: systemMessage,
      })
      
      console.log(`[Socket] Consultation ended for appointment ${appointmentId} by doctor ${senderId}`)
    } catch (error) {
      console.error('[Socket] Failed to end consultation:', error)
      socket.emit('error', { message: 'Failed to end consultation' })
    }
  }
}

/**
 * Handle chat block event
 * Only doctors can block chat (after consultation is completed)
 */
export function createChatBlockHandler(io: SocketIOServer, payload: Payload) {
  return async (socket: AuthenticatedSocket, data: ChatBlockPayload) => {
    const { appointmentId } = data
    const { senderType, senderId } = socket.data

    // Only doctors can block chat
    if (senderType !== 'doctor') {
      socket.emit('error', { message: 'Only doctors can block chat' })
      return
    }

    if (!isValidAppointmentId(appointmentId)) {
      socket.emit('error', { message: 'Invalid appointment ID' })
      return
    }

    // Verify the doctor has access to this appointment
    const accessResult = await verifyAppointmentAccess(payload, appointmentId, undefined, senderId)
    if (!accessResult.hasAccess) {
      socket.emit('error', { message: 'Access denied to this appointment' })
      return
    }

    try {
      // Get current appointment to check if it's completed
      const appointment = await payload.findByID({
        collection: 'appointments',
        id: appointmentId,
        overrideAccess: true,
      })

      if (appointment.status !== 'completed') {
        socket.emit('error', { message: 'Can only block chat for completed consultations' })
        return
      }

      // Update appointment to block chat
      await payload.update({
        collection: 'appointments',
        id: appointmentId,
        data: { chatBlocked: true } as Record<string, unknown>,
        overrideAccess: true,
      })

      // Emit to all clients in the room
      const room = `appointment:${appointmentId}`
      io.to(room).emit('chat-blocked', { appointmentId })
      
      console.log(`[Socket] Chat blocked for appointment ${appointmentId} by doctor ${senderId}`)
    } catch (error) {
      console.error('[Socket] Failed to block chat:', error)
      socket.emit('error', { message: 'Failed to block chat' })
    }
  }
}

/**
 * Handle chat unblock event
 * Only doctors can unblock chat (after consultation is completed)
 */
export function createChatUnblockHandler(io: SocketIOServer, payload: Payload) {
  return async (socket: AuthenticatedSocket, data: ChatUnblockPayload) => {
    const { appointmentId } = data
    const { senderType, senderId } = socket.data

    // Only doctors can unblock chat
    if (senderType !== 'doctor') {
      socket.emit('error', { message: 'Only doctors can unblock chat' })
      return
    }

    if (!isValidAppointmentId(appointmentId)) {
      socket.emit('error', { message: 'Invalid appointment ID' })
      return
    }

    // Verify the doctor has access to this appointment
    const accessResult = await verifyAppointmentAccess(payload, appointmentId, undefined, senderId)
    if (!accessResult.hasAccess) {
      socket.emit('error', { message: 'Access denied to this appointment' })
      return
    }

    try {
      // Get current appointment to check if it's completed
      const appointment = await payload.findByID({
        collection: 'appointments',
        id: appointmentId,
        overrideAccess: true,
      })

      if (appointment.status !== 'completed') {
        socket.emit('error', { message: 'Can only unblock chat for completed consultations' })
        return
      }

      // Update appointment to unblock chat
      await payload.update({
        collection: 'appointments',
        id: appointmentId,
        data: { chatBlocked: false } as Record<string, unknown>,
        overrideAccess: true,
      })

      // Emit to all clients in the room
      const room = `appointment:${appointmentId}`
      io.to(room).emit('chat-unblocked', { appointmentId })
      
      console.log(`[Socket] Chat unblocked for appointment ${appointmentId} by doctor ${senderId}`)
    } catch (error) {
      console.error('[Socket] Failed to unblock chat:', error)
      socket.emit('error', { message: 'Failed to unblock chat' })
    }
  }
}

/**
 * Handle connection type change event
 * Only patients (users) can change their preferred connection type
 */
export function createChangeConnectionTypeHandler(io: SocketIOServer, payload: Payload) {
  return async (socket: AuthenticatedSocket, data: ChangeConnectionTypePayload) => {
    const { appointmentId, connectionType } = data
    const { senderType, senderId } = socket.data

    // Only patients can change connection type
    if (senderType !== 'user') {
      socket.emit('error', { message: 'Only patients can change connection type' })
      return
    }

    if (!isValidAppointmentId(appointmentId)) {
      socket.emit('error', { message: 'Invalid appointment ID' })
      return
    }

    // Validate connection type
    if (!['chat', 'audio', 'video'].includes(connectionType)) {
      socket.emit('error', { message: 'Invalid connection type' })
      return
    }

    // Verify the patient has access to this appointment
    const accessResult = await verifyAppointmentAccess(payload, appointmentId, senderId, undefined)
    if (!accessResult.hasAccess) {
      socket.emit('error', { message: 'Access denied to this appointment' })
      return
    }

    try {
      // Get current appointment to check current connection type
      const appointment = await payload.findByID({
        collection: 'appointments',
        id: appointmentId,
        overrideAccess: true,
      }) as { connectionType?: string }

      // Skip if same connection type
      if (appointment.connectionType === connectionType) {
        return
      }

      // Update appointment connection type
      await payload.update({
        collection: 'appointments',
        id: appointmentId,
        data: { connectionType } as Record<string, unknown>,
        overrideAccess: true,
      })

      // Create a system message
      const connectionTypeLabels: Record<string, string> = {
        chat: 'Чат',
        audio: 'Аудио',
        video: 'Видео',
      }
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const systemMessage = await (payload.create as any)({
        collection: 'messages',
        data: {
          appointment: appointmentId,
          text: `Пациент изменил предпочтительный способ связи на "${connectionTypeLabels[connectionType]}"`,
          isSystemMessage: true,
          read: false,
        },
        overrideAccess: true,
      })

      // Emit to all clients in the room
      const room = `appointment:${appointmentId}`
      io.to(room).emit('connection-type-changed', { 
        appointmentId, 
        connectionType,
        message: systemMessage,
      })
      
      console.log(`[Socket] Connection type changed to ${connectionType} for appointment ${appointmentId} by patient ${senderId}`)
    } catch (error) {
      console.error('[Socket] Failed to change connection type:', error)
      socket.emit('error', { message: 'Failed to change connection type' })
    }
  }
}
