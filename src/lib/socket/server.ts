import type { Server as SocketIOServer, Socket } from 'socket.io'
import type { Payload } from 'payload'
import getCookieValue from './utils/getCookieValue'
import verifyToken from './utils/verifyToken'
import isValidAppointmentId from './utils/isValidAppointmentId'
import verifyAppointmentAccess from './utils/verifyAppointmentAccess'
import validateMessageText from './utils/validateMessageText'
import isValidSenderType from './utils/isValidSenderType'


interface AuthenticatedSocket extends Socket {
  data: {
    userId?: number
    doctorId?: number
    senderType: 'user' | 'doctor'
    senderId: number
    // Track rooms where user is typing (for cleanup on disconnect)
    typingInRooms: Set<string>
  }
}

interface SendMessagePayload {
  appointmentId: number
  text: string
  preferredSenderType?: 'user' | 'doctor'
}

interface JoinRoomPayload {
  appointmentId: number
  preferredSenderType?: 'user' | 'doctor'
}

interface MarkReadPayload {
  appointmentId: number
  preferredSenderType?: 'user' | 'doctor'
}





/**
 * [RATE LIMITING] Cleanup expired rate limit entries periodically
 */
function cleanupRateLimits() {
  const now = Date.now()
  for (const [socketId, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(socketId)
    }
  }
}


// Сокет io сервер запускается.
export function initializeSocketServer(io: SocketIOServer, payload: Payload) {
  // [RATE LIMITING] Cleanup expired entries every 30 seconds
  const cleanupInterval = setInterval(cleanupRateLimits, 30000)
  
  // Cleanup interval on server shutdown
  io.engine.on('close', () => {
    clearInterval(cleanupInterval)
  })

  // Проверка пользователя
  io.use((socket, next) => {
    // Так я могу увидеть куки из хэдэров
    const cookies = socket.handshake.headers.cookie || ''
    
    let userId: number | undefined
    let doctorId: number | undefined
    let primarySenderType: 'user' | 'doctor' | null = null
    let primarySenderId: number | null = null

    // Забираю токен пользователя
    const userToken = getCookieValue(cookies, 'payload-token')
    if (userToken) {
      const decoded = verifyToken(userToken)
      if (decoded?.id) {
        userId = decoded.id
        primarySenderType = 'user'
        primarySenderId = decoded.id
      }
    }

    // Забираю токен доктора
    const doctorToken = getCookieValue(cookies, 'doctors-token')
    if (doctorToken) {
      const decoded = verifyToken(doctorToken)
      if (decoded?.id) {
        doctorId = decoded.id
        if (!primarySenderType) {
          primarySenderType = 'doctor'
          primarySenderId = decoded.id
        }
      }
    }

    // Если не авторизован - отклоняем
    if (!primarySenderType || !primarySenderId) {
      return next(new Error('Authentication required'))
    }

    // Ставим userId и doctorId в дату сокета
    ;(socket as AuthenticatedSocket).data = {
      userId,
      doctorId,
      senderType: primarySenderType,
      senderId: primarySenderId,
      typingInRooms: new Set(),
    }
    
    return next()
  })

  io.on('connection', (socket: Socket) => {
    const authSocket = socket as AuthenticatedSocket // Тут уже есть данные после io.use
    console.log(`[Socket] Client connected: ${socket.id}, type: ${authSocket.data.senderType}, id: ${authSocket.data.senderId}`)

    // Когда чувак входит в чат (именно в какую - то конкрутную консультаицю)
    socket.on('join-room', async (data: JoinRoomPayload) => {
      const { appointmentId } = data

      // Тут откидываем, если он глупец
      if (!isValidAppointmentId(appointmentId)) {
        socket.emit('error', { message: 'Некорректный ID консультации' })
        return
      }
      
      // Дан ли доступ
      const accessResult = await verifyAppointmentAccess(
        payload,
        appointmentId,
        authSocket.data.userId,
        authSocket.data.doctorId
      )

      if (!accessResult.hasAccess) {
        // Если нет, то сокеты ломаются
        payload.logger.warn(`⚠️ Denied access: socket=${socket.id}, appointment=${appointmentId}`)
        socket.emit('error', { message: 'Нет доступа к этой консультации' })
        return
      }

      // Создаем комнатку
      const roomName = `appointment:${appointmentId}`
      // Подключаемся к ней
      socket.join(roomName)
      console.log(`[Socket] ${accessResult.accessType}:${accessResult.accessId} joined room ${roomName}`)
      
      // Отправляем что подключено к комнатке
      socket.emit('joined-room', { appointmentId, roomName })
    })

    // Теперь leave-room , чтобы выййти из комнатки
    socket.on('leave-room', (data: JoinRoomPayload) => {
      const { appointmentId } = data

      // Протсо проврека валидации
      if (!isValidAppointmentId(appointmentId)) {
        return
      }

      // определяем комнатку и выходим
      const roomName = `appointment:${appointmentId}`
      socket.leave(roomName)
      
      // Удаляем из экземпляра сокета эту комнату
      authSocket.data.typingInRooms.delete(roomName)
      
      console.log(`[Socket] ${authSocket.data.senderType}:${authSocket.data.senderId} left room ${roomName}`)
    })

    // Событие на отсылку сообщений
    socket.on('send-message', async (data: SendMessagePayload) => {
      // Самое главное!
      if (isRateLimited(socket.id)) {
        socket.emit('error', { message: 'Слишком много запросов' })
        return
      }

      const { appointmentId, text, preferredSenderType } = data

      // Опять дефолтна проверка
      if (!isValidAppointmentId(appointmentId)) {
        socket.emit('error', { message: 'Некорректный ID консультации' })
        return
      }

      // Удаляем пробельчики
      const validatedText = validateMessageText(text)
      if (!validatedText) {
        socket.emit('error', { message: 'Сообщение не может быть пустым' })
        return
      }

      // Проверяем чтобы senderType относится к тому, к кому нужно
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

      // Отказываем в доступе в случае неудалчи
      if (!accessResult.hasAccess) {
        payload.logger.warn(`⚠️ Denied access: socket=${socket.id}, appointment=${appointmentId}`)
        socket.emit('error', { message: 'Нет доступа к этой консультации' })
        return
      }

      // Достпут
      let senderType = accessResult.accessType!
      let senderId = accessResult.accessId!
      
      // Ставим senderType
      if (preferredSenderType && accessResult.appointment) {
        const appointment = accessResult.appointment
        const appointmentUserId = typeof appointment.user === 'object' 
          ? (appointment.user as { id: number }).id 
          : appointment.user as number
        const appointmentDoctorId = typeof appointment.doctor === 'object' 
          ? (appointment.doctor as { id: number }).id 
          : appointment.doctor as number
        
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
    })

    // Событие прочитки сообщений.
    socket.on('mark-read', async (data: MarkReadPayload) => {
      const { appointmentId, preferredSenderType } = data

      // [
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
        payload.logger.warn(`⚠️ Denied access: socket=${socket.id}, appointment=${appointmentId}`)
        return
      }

      // Determine the actual sender type
      let actualSenderType = accessResult.accessType!
      
      // [OPTIMIZATION] Reuse appointment from verifyAppointmentAccess
      if (preferredSenderType && accessResult.appointment) {
        const appointment = accessResult.appointment
        const appointmentUserId = typeof appointment.user === 'object' 
          ? (appointment.user as { id: number }).id 
          : appointment.user as number
        const appointmentDoctorId = typeof appointment.doctor === 'object' 
          ? (appointment.doctor as { id: number }).id 
          : appointment.doctor as number
        
        if (preferredSenderType === 'user' && authSocket.data.userId === appointmentUserId) {
          actualSenderType = 'user'
        } else if (preferredSenderType === 'doctor' && authSocket.data.doctorId === appointmentDoctorId) {
          actualSenderType = 'doctor'
        }
      }

      try {
        // Mark all unread messages from the OTHER party as read
        const otherSenderType = actualSenderType === 'user' ? 'doctor' : 'user'

        await payload.update({
          collection: 'messages',
          where: {
            appointment: { equals: appointmentId },
            senderType: { equals: otherSenderType },
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
    })

    // [SECURITY FIX] Typing indicator with access verification
    socket.on('typing', async (data: JoinRoomPayload) => {
      const { appointmentId, preferredSenderType } = data

      // [INPUT VALIDATION] Validate inputs
      if (!isValidAppointmentId(appointmentId)) {
        return
      }

      if (!isValidSenderType(preferredSenderType)) {
        return
      }

      // [SECURITY FIX] Verify access before emitting typing event
      const accessResult = await verifyAppointmentAccess(
        payload,
        appointmentId,
        authSocket.data.userId,
        authSocket.data.doctorId
      )

      if (!accessResult.hasAccess) {
        // Silently ignore - don't spam errors for typing events
        return
      }

      const roomName = `appointment:${appointmentId}`
      
      // [CLEANUP] Track that user is typing in this room
      authSocket.data.typingInRooms.add(roomName)
      
      // Use preferred sender type if provided and valid, otherwise use access result
      const senderType = preferredSenderType || accessResult.accessType!
      const senderId = senderType === 'user' ? authSocket.data.userId : authSocket.data.doctorId
      
      socket.to(roomName).emit('user-typing', {
        appointmentId,
        senderType,
        senderId: senderId || accessResult.accessId,
      })
    })

    // [SECURITY FIX] Stop typing with access verification
    socket.on('stop-typing', async (data: JoinRoomPayload) => {
      const { appointmentId, preferredSenderType } = data

      // [INPUT VALIDATION] Validate inputs
      if (!isValidAppointmentId(appointmentId)) {
        return
      }

      if (!isValidSenderType(preferredSenderType)) {
        return
      }

      // [SECURITY FIX] Verify access before emitting stop-typing event
      const accessResult = await verifyAppointmentAccess(
        payload,
        appointmentId,
        authSocket.data.userId,
        authSocket.data.doctorId
      )

      if (!accessResult.hasAccess) {
        // Silently ignore - don't spam errors for typing events
        return
      }

      const roomName = `appointment:${appointmentId}`
      
      // [CLEANUP] Remove from typing rooms
      authSocket.data.typingInRooms.delete(roomName)
      
      // Use preferred sender type if provided and valid, otherwise use access result
      const senderType = preferredSenderType || accessResult.accessType!
      const senderId = senderType === 'user' ? authSocket.data.userId : authSocket.data.doctorId
      
      socket.to(roomName).emit('user-stop-typing', {
        appointmentId,
        senderType,
        senderId: senderId || accessResult.accessId,
      })
    })

    // [CLEANUP] Handle disconnect - stop typing in all rooms
    socket.on('disconnect', () => {
      // Send stop-typing to all rooms where user was typing
      for (const roomName of authSocket.data.typingInRooms) {
        socket.to(roomName).emit('user-stop-typing', {
          appointmentId: parseInt(roomName.replace('appointment:', ''), 10),
          senderType: authSocket.data.senderType,
          senderId: authSocket.data.senderId,
        })
      }
      
      // [RATE LIMITING] Cleanup rate limit entry
      rateLimitMap.delete(socket.id)
      
      console.log(`[Socket] Client disconnected: ${socket.id}`)
    })
  })

  console.log('[Socket] Socket.IO server initialized')
}
