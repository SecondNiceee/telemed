import type { Server as SocketIOServer } from 'socket.io'
import type { Payload } from 'payload'
import type { AuthenticatedSocket, SendMessagePayload } from '../types'
import isRateLimited from '../utils/isRateLimited'
import isValidAppointmentId from '../utils/isValidAppointmentId'
import validateMessageText from '../utils/validateMessageText'
import isValidSenderType from '../utils/isValidSenderType'
import verifyAppointmentAccess from '../utils/verifyAppointmentAccess'
import { buildParticipantsPrivacy } from '@/lib/server/media-privacy'

type SendMessageAck = (result: { success: true } | { success: false; error: string }) => void

export function createSendMessageHandler(io: SocketIOServer, payload: Payload) {
  return async (authSocket: AuthenticatedSocket, data: SendMessagePayload, ack?: SendMessageAck) => {
      const fail = (message: string) => {
        authSocket.emit('error', { message })
        ack?.({ success: false, error: message })
      }

      // Самое главное - rate limiting!
      // Ключ по личности отправителя, а не по socket.id: несколько вкладок
      // у одного пользователя не должны суммарно обходить лимит.
      const rateLimitKey = authSocket.data.senderType && authSocket.data.senderId
        ? `${authSocket.data.senderType}:${authSocket.data.senderId}`
        : `socket:${authSocket.id}`
      if (isRateLimited(rateLimitKey)) {
        fail('Слишком много запросов')
        return
      }

      const { appointmentId, text, preferredSenderType, attachmentId, clientMessageId } = data

      if (typeof clientMessageId !== 'string' || clientMessageId.length < 8 || clientMessageId.length > 100) {
        fail('Некорректный ID сообщения')
        return
      }

      // Опять дефолтная проверка
      if (!isValidAppointmentId(appointmentId)) {
        fail('Некорректный ID консультации')
        return
      }

      // Удаляем пробелы
      const validatedText = validateMessageText(text)
      
      // Нужен хотя бы текст или attachment
      if (!validatedText && !attachmentId) {
        fail('Сообщение не может быть пустым')
        return
      }
      
      // Validate attachmentId if provided
      if (attachmentId !== undefined && (typeof attachmentId !== 'number' || attachmentId <= 0)) {
        fail('Некорректный ID файла')
        return
      }

      // Проверяем чтобы senderType относился к тому, к кому нужно
      if (!isValidSenderType(preferredSenderType)) {
        fail('Некорректный тип отправителя')
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
        payload.logger.warn(`⚠️ Denied access: socket=${authSocket.id}, appointment=${appointmentId}`)
        fail('Нет доступа к этой консультации')
        return
      }

      if (accessResult.appointment?.status === 'cancelled') {
        fail('Консультация была отменена')
        return
      }

      // Доступ
      let senderType = accessResult.accessType!
      let senderId = accessResult.accessId!

      // Серверная защита блокировки чата: если врач заблокировал чат, пациент
      // не может отправлять сообщения даже напрямую через сокет (в обход UI).
      // Врач при этом писать может всегда.
      if (senderType === 'user' && accessResult.appointment?.chatBlocked === true) {
        fail('Чат заблокирован врачом')
        return
      }

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
        const existingMessage = await payload.find({
          collection: 'messages',
          where: { clientMessageId: { equals: clientMessageId } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        if (existingMessage.docs.length > 0) {
          ack?.({ success: true })
          return
        }

        // Build message data with polymorphic sender
        const senderRelationTo = senderType === 'user' ? 'users' : 'doctors'
        const messageData: {
          appointment: number
          sender: { relationTo: 'users' | 'doctors'; value: number }
          text?: string
          attachment?: number
          read: boolean
          clientMessageId: string
        } = {
          appointment: appointmentId,
          clientMessageId,
          sender: {
            relationTo: senderRelationTo,
            value: senderId,
          },
          read: false,
        }
        
        if (validatedText) {
          messageData.text = validatedText
        }
        
        if (attachmentId) {
          messageData.attachment = attachmentId
        }
        
        // Save message to database
        const message = await payload.create({
          collection: 'messages',
          data: messageData,
          overrideAccess: true,
        })
        
        // Вложение чата закрываем от посторонних.
        //
        // Файл загружается клиентом в media заранее, отдельным запросом, и до
        // этого момента считается публичным (иначе фото врачей и иконки
        // категорий пришлось бы помечать при каждой загрузке). Как только файл
        // прикреплён к сообщению, участники переписки известны точно - здесь и
        // выставляем приватность.
        //
        // Права считаем на сервере из самой консультации, а не из данных
        // клиента: иначе отправитель мог бы выдать доступ кому угодно.
        if (attachmentId && accessResult.appointment) {
          const appointment = accessResult.appointment
          const patientId =
            typeof appointment.user === 'object'
              ? (appointment.user as { id: number }).id
              : (appointment.user as number)
          const attachmentDoctorId =
            typeof appointment.doctor === 'object'
              ? (appointment.doctor as { id: number }).id
              : (appointment.doctor as number)

          try {
            await payload.update({
              collection: 'media',
              id: attachmentId,
              data: buildParticipantsPrivacy(patientId, attachmentDoctorId),
              overrideAccess: true,
            })
          } catch (error) {
            // Сообщение уже сохранено, ронять отправку нельзя. Но факт того,
            // что файл остался публичным, обязан попасть в лог.
            console.error('[chat] Не удалось закрыть вложение от посторонних', {
              attachmentId,
              appointmentId,
              error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
            })
          }
        }

        // Fetch attachment details if present
        let attachmentData = null
        if (attachmentId) {
          try {
            const media = await payload.findByID({
              collection: 'media',
              id: attachmentId,
            })
            if (media) {
              attachmentData = {
                id: media.id,
                url: media.url,
                filename: media.filename,
                mimeType: media.mimeType,
                filesize: media.filesize,
                width: media.width,
                height: media.height,
              }
            }
          } catch {
            // Ignore errors fetching attachment
          }
        }

        const roomName = `appointment:${appointmentId}`

        // Вызываем у всех в этой комнате это событие
        // Формируем sender вручную, т.к. payload.create может вернуть просто ID
        io.to(roomName).emit('new-message', {
          id: message.id,
          clientMessageId,
          appointment: appointmentId,
          sender: {
            relationTo: senderRelationTo,
            value: senderId,
          },
          text: message.text || null,
          attachment: attachmentData,
          read: message.read,
          createdAt: message.createdAt,
        })

        console.log(`[Socket] Message sent in room ${roomName} by ${senderType}:${senderId}`)
        ack?.({ success: true })

        // Глобальное уведомление второму участнику в его персональную комнату:
        // доставляетс�� на любой странице сайта, а не только в открытом чате.
        try {
          const appointment = accessResult.appointment!
          const recipientType = senderType === 'user' ? 'doctor' : 'user'
          const recipientId = recipientType === 'user'
            ? (typeof appointment.user === 'object' ? (appointment.user as { id: number }).id : (appointment.user as number))
            : (typeof appointment.doctor === 'object' ? (appointment.doctor as { id: number }).id : (appointment.doctor as number))

          let senderName = senderType === 'user' ? 'Пациент' : 'Врач'
          try {
            const senderDoc = await payload.findByID({
              collection: senderRelationTo,
              id: senderId,
              depth: 0,
              overrideAccess: true,
            })
            if (senderDoc && typeof senderDoc.name === 'string' && senderDoc.name.trim()) {
              senderName = senderDoc.name
            }
          } catch {
            // Имя не критично — используем дефолтное.
          }

          io.to(`${recipientType}:${recipientId}`).emit('message-notification', {
            messageId: message.id,
            appointmentId,
            recipientType,
            senderName,
            text: validatedText
              ? (validatedText.length > 120 ? `${validatedText.slice(0, 120)}…` : validatedText)
              : 'Вложение',
          })
        } catch (notifyErr) {
          console.error('[Socket] Failed to send message notification:', notifyErr)
        }
      } catch (err) {
        console.error('[Socket] Failed to save message:', err)
        fail('Ошибка при отправке сообщения')
      }
  }
}
