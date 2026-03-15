import type { Server as SocketIOServer, Socket } from 'socket.io'
import type { Payload } from 'payload'
import type { AuthenticatedSocket, SendMessagePayload } from '../types'
import isRateLimited from '../utils/isRateLimited'
import isValidAppointmentId from '../utils/isValidAppointmentId'
import validateMessageText from '../utils/validateMessageText'
import isValidSenderType from '../utils/isValidSenderType'
import verifyAppointmentAccess from '../utils/verifyAppointmentAccess'

export function createSendMessageHandler(io: SocketIOServer, payload: Payload, socket: Socket) {
  const authSocket = socket as AuthenticatedSocket
  return async (data: SendMessagePayload) => {

      // Самое главное - rate limiting!
      if (isRateLimited(socket.id)) {
        socket.emit('error', { message: 'Слишком много запросов' })
        return
      }

      const { appointmentId, text, preferredSenderType } = data

      // Опять дефолтная проверка
      if (!isValidAppointmentId(appointmentId)) {
        socket.emit('error', { message: 'Некорректный ID консультации' })
        return
      }

      // Удаляем пробелы
      const validatedText = validateMessageText(text)
      if (!validatedText) {
        socket.emit('error', { message: 'Сообщение не может быть пустым' })
        return
      }

      // Проверяем чтобы senderType относился к тому, к кому нужно
      if (!isValidSenderType(preferredSenderType)) {
        socket.emit('error', { message: 'Некорректный тип отправителя' })
        return
      }

      // Проверяем доступ опять
      const accessResult = await verifyAppointmentAccess(
        payload,
        appointmentId,
        authSocket.data.userId,
        authSocket.data.doctorId
      )

      // Отказываем в доступе в случае неудачи
      if (!accessResult.hasAccess) {
        payload.logger.warn(`⚠️ Denied access: socket=${socket.id}, appointment=${appointmentId}`)
        socket.emit('error', { message: 'Нет доступа к этой консультации' })
        return
      }

      // Доступ
      let senderType = accessResult.accessType!
      let senderId = accessResult.accessId!

      // Ставим senderType
      if (preferredSenderType && accessResult.appointment) {
        const appointment = accessResult.appointment
        const appointmentUserId = typeof appointment.user === 'object'
          ? (appointment.user as { id: number }).id
          : (appointment.user as number)
        const appointmentDoctorId = typeof appointment.doctor === 'object'
          ? (appointment.doctor as { id: number }).id
          : (appointment.doctor as number)

        if (preferredSenderType === 'user' && authSocket.data.userId === appointmentUserId) {
          senderType = 'user'
          senderId = appointmentUserId
        } else if (preferredSenderType === 'doctor' && authSocket.data.doctorId === appointmentDoctorId) {
          senderType = 'doctor'
          senderId = appointmentDoctorId
        }
      }

      try {
        // Save message to database
        const message = await payload.create({
          collection: 'messages',
          data: {
            appointment: appointmentId,
            senderType: senderType,
            senderId: senderId,
            text: validatedText,
            read: false,
          },
          overrideAccess: true,
        })

        const roomName = `appointment:${appointmentId}`

        // Вызываем у всех в этой комнате это событие
        io.to(roomName).emit('new-message', {
          id: message.id,
          appointment: appointmentId,
          senderType: message.senderType,
          senderId: message.senderId,
          text: message.text,
          read: message.read,
          createdAt: message.createdAt,
        })

        console.log(`[Socket] Message sent in room ${roomName} by ${senderType}:${senderId}`)
      } catch (err) {
        console.error('[Socket] Failed to save message:', err)
        socket.emit('error', { message: 'Ошибка при отправке сообщения' })
      }
  }
}
