import type { Server as SocketIOServer } from 'socket.io'
import type { Payload } from 'payload'
import type { AuthenticatedSocket, MarkReadPayload } from '../types'
import isValidAppointmentId from '../utils/isValidAppointmentId'
import isValidSenderType from '../utils/isValidSenderType'
import verifyAppointmentAccess from '../utils/verifyAppointmentAccess'

export function createMarkReadHandler(io: SocketIOServer, payload: Payload) {
  return async (authSocket: AuthenticatedSocket, data: MarkReadPayload) => {
    const { appointmentId, preferredSenderType } = data

    // [INPUT VALIDATION] Validate inputs
    if (!isValidAppointmentId(appointmentId)) {
      return
    }

    if (!isValidSenderType(preferredSenderType)) {
      return
    }

    // [OPTIMIZATION] Verify access and get appointment in one query
    const accessResult = await verifyAppointmentAccess(
      payload,
      appointmentId,
      authSocket.data.userId,
      authSocket.data.doctorId
    )

    if (!accessResult.hasAccess) {
      // [SECURITY LOGGING] Log denied access
      payload.logger.warn(`⚠️ Denied access: socket=${authSocket.id}, appointment=${appointmentId}`)
      return
    }

    // [SECURITY] Verify that preferredSenderType matches the user's actual permissions
    // preferredSenderType is now REQUIRED (validated above by isValidSenderType)
    const appointment = accessResult.appointment!
    const appointmentUserId = typeof appointment.user === 'object' 
      ? (appointment.user as { id: number }).id 
      : appointment.user as number
    const appointmentDoctorId = typeof appointment.doctor === 'object' 
      ? (appointment.doctor as { id: number }).id 
      : appointment.doctor as number
    
    let actualSenderType: 'user' | 'doctor'
    
    if (preferredSenderType === 'user' && authSocket.data.userId === appointmentUserId) {
      actualSenderType = 'user'
    } else if (preferredSenderType === 'doctor' && authSocket.data.doctorId === appointmentDoctorId) {
      actualSenderType = 'doctor'
    } else {
      // [SECURITY] User specified a senderType they don't have permission for
      payload.logger.warn(`⚠️ Sender type mismatch: socket=${authSocket.id}, appointment=${appointmentId}, preferredSenderType=${preferredSenderType}`)
      authSocket.emit('error', { message: 'У вас нет прав для отправки сообщений с этим типом отправителя' })
      return
    }

    try {
      // Mark all unread messages from the OTHER party as read
      // С полиморфной связью sender.relationTo указывает на коллекцию
      const otherRelationTo = actualSenderType === 'user' ? 'doctors' : 'users'

      await payload.update({
        collection: 'messages',
        where: {
          appointment: { equals: appointmentId },
          'sender.relationTo': { equals: otherRelationTo },
          read: { equals: false },
        },
        data: { read: true },
        overrideAccess: true,
      })

      const roomName = `appointment:${appointmentId}`
      io.to(roomName).emit('messages-read', {
        appointmentId,
        readBy: actualSenderType,
      })
    } catch (err) {
      console.error('[Socket] Failed to mark messages as read:', err)
    }
  }
}
