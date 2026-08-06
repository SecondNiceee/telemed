import type { AuthenticatedSocket, JoinRoomPayload } from '../types'
import isValidAppointmentId from '../utils/isValidAppointmentId'

export function createLeaveRoomHandler() {
  return (socket: AuthenticatedSocket, data: JoinRoomPayload) => {
    const { appointmentId } = data

    // Проверка на валидность ID
    if (!isValidAppointmentId(appointmentId)) {
      return
    }

    // Определяем комнатку и выходим
    const roomName = `appointment:${appointmentId}`
    socket.leave(roomName)
    
    // Удаляем комнату из экземпляра сокета
    socket.data.typingInRooms.delete(roomName)
    
    console.log(`[Socket] ${socket.data.senderType}:${socket.data.senderId} left room ${roomName}`)
  }
}
