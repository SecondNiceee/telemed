import type { AuthenticatedSocket, TypingPayload } from '../types'
import isValidAppointmentId from '../utils/isValidAppointmentId'
import isValidSenderType from '../utils/isValidSenderType'

export function createTypingHandler() {
  return (socket: AuthenticatedSocket, data: TypingPayload) => {
    const { appointmentId, preferredSenderType } = data

    // [INPUT VALIDATION] Validate inputs
    if (!isValidAppointmentId(appointmentId)) {
      return
    }

    if (!isValidSenderType(preferredSenderType)) {
      return
    }

    const roomName = `appointment:${appointmentId}`
    
    // [CLEANUP] Track that user is typing in this room
    socket.data.typingInRooms.add(roomName)
    
    // [NOTE] typing events don't modify DB, so no need to verify appointment access
    socket.to(roomName).emit('user-typing', {
      appointmentId,
      senderType: preferredSenderType,
      senderId: preferredSenderType === 'user' ? socket.data.userId : socket.data.doctorId,
    })
  }
}
