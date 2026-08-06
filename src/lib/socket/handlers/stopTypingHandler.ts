import type { AuthenticatedSocket, StopTypingPayload } from '../types'
import isValidAppointmentId from '../utils/isValidAppointmentId'
import isValidSenderType from '../utils/isValidSenderType'

export function createStopTypingHandler() {
  return (socket: AuthenticatedSocket, data: StopTypingPayload) => {
    const { appointmentId, preferredSenderType } = data

    // [INPUT VALIDATION] Validate inputs
    if (!isValidAppointmentId(appointmentId)) {
      return
    }

    if (!isValidSenderType(preferredSenderType)) {
      return
    }

    const roomName = `appointment:${appointmentId}`
    
    // [CLEANUP] Remove from typing rooms
    socket.data.typingInRooms.delete(roomName)
    
    // [NOTE] typing events don't modify DB, so no need to verify appointment access
    socket.to(roomName).emit('user-stop-typing', {
      appointmentId,
      senderType: preferredSenderType,
      senderId: preferredSenderType === 'user' ? socket.data.userId : socket.data.doctorId,
    })
  }
}
