import type { Payload } from 'payload'
import type { AuthenticatedSocket, JoinRoomPayload } from '../types'
import isValidAppointmentId from '../utils/isValidAppointmentId'
import verifyAppointmentAccess from '../utils/verifyAppointmentAccess'

export function createJoinRoomHandler(payload: Payload) {
  return async (socket: AuthenticatedSocket, data: JoinRoomPayload) => {
    const { appointmentId } = data

    // Проверка на валидность ID консультации
    if (!isValidAppointmentId(appointmentId)) {
      socket.emit('error', { message: 'Некорректный ID консультации' })
      return
    }
    
    // Проверяем доступ
    const accessResult = await verifyAppointmentAccess(
      payload,
      appointmentId,
      socket.data.userId,
      socket.data.doctorId
    )

    if (!accessResult.hasAccess) {
      // Если нет доступа
      payload.logger.warn(`⚠️ Denied access: socket=${socket.id}, appointment=${appointmentId}`)
      socket.emit('error', { message: 'Нет доступа к этой консультации' })
      return
    }

    // Создаем комнатку и подключаемся
    const roomName = `appointment:${appointmentId}`
    socket.join(roomName)
    console.log(`[Socket] ${accessResult.accessType}:${accessResult.accessId} joined room ${roomName}`)
    
    // Отправляем подтверждение подключения
    socket.emit('joined-room', { appointmentId, roomName })
  }
}
