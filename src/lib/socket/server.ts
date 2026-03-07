import type { Server as SocketIOServer, Socket } from 'socket.io'
import type { Payload } from 'payload'
import jwt from 'jsonwebtoken'

interface DecodedToken {
  id: number
  email?: string
  collection?: string
  role?: string
}

interface AuthenticatedSocket extends Socket {
  data: {
    userId?: number
    doctorId?: number
    senderType: 'user' | 'doctor'
    senderId: number
  }
}

interface SendMessagePayload {
  appointmentId: number
  text: string
}

interface JoinRoomPayload {
  appointmentId: number
}

interface MarkReadPayload {
  appointmentId: number
}

/**
 * Parse cookie string and get value by name
 */
function getCookieValue(cookieString: string, name: string): string | null {
  const match = cookieString.match(new RegExp(`${name}=([^;]+)`))
  return match ? match[1] : null
}

/**
 * Decode JWT token without verification (we trust the server-set cookies)
 */
function decodeToken(token: string): DecodedToken | null {
  try {
    return jwt.decode(token) as DecodedToken | null
  } catch {
    return null
  }
}

/**
 * Verify that the user/doctor has access to the appointment
 */
async function verifyAppointmentAccess(
  payload: Payload,
  appointmentId: number,
  senderType: 'user' | 'doctor',
  senderId: number
): Promise<boolean> {
  try {
    const appointment = await payload.findByID({
      collection: 'appointments',
      id: appointmentId,
      overrideAccess: true,
    })

    if (!appointment) return false

    if (senderType === 'user') {
      const userId = typeof appointment.user === 'object' ? appointment.user.id : appointment.user
      return userId === senderId
    } else {
      const doctorId = typeof appointment.doctor === 'object' ? appointment.doctor.id : appointment.doctor
      return doctorId === senderId
    }
  } catch {
    return false
  }
}

/**
 * Initialize Socket.IO server with event handlers
 */
export function initializeSocketServer(io: SocketIOServer, payload: Payload) {
  // Authentication middleware
  io.use((socket, next) => {
    const cookies = socket.handshake.headers.cookie || ''
    
    // Try to get user token first
    const userToken = getCookieValue(cookies, 'payload-token')
    if (userToken) {
      const decoded = decodeToken(userToken)
      if (decoded?.id) {
        ;(socket as AuthenticatedSocket).data = {
          userId: decoded.id,
          senderType: 'user',
          senderId: decoded.id,
        }
        return next()
      }
    }

    // Try doctor token
    const doctorToken = getCookieValue(cookies, 'doctors-token')
    if (doctorToken) {
      const decoded = decodeToken(doctorToken)
      if (decoded?.id) {
        ;(socket as AuthenticatedSocket).data = {
          doctorId: decoded.id,
          senderType: 'doctor',
          senderId: decoded.id,
        }
        return next()
      }
    }

    return next(new Error('Authentication required'))
  })

  io.on('connection', (socket: Socket) => {
    const authSocket = socket as AuthenticatedSocket
    console.log(`[Socket] Client connected: ${socket.id}, type: ${authSocket.data.senderType}, id: ${authSocket.data.senderId}`)

    // Join room for a specific appointment chat
    socket.on('join-room', async (data: JoinRoomPayload) => {
      const { appointmentId } = data
      
      // Verify access to the appointment
      const hasAccess = await verifyAppointmentAccess(
        payload,
        appointmentId,
        authSocket.data.senderType,
        authSocket.data.senderId
      )

      if (!hasAccess) {
        socket.emit('error', { message: 'Нет доступа к этой консультации' })
        return
      }

      const roomName = `appointment:${appointmentId}`
      socket.join(roomName)
      console.log(`[Socket] ${authSocket.data.senderType}:${authSocket.data.senderId} joined room ${roomName}`)
      
      socket.emit('joined-room', { appointmentId, roomName })
    })

    // Leave room
    socket.on('leave-room', (data: JoinRoomPayload) => {
      const { appointmentId } = data
      const roomName = `appointment:${appointmentId}`
      socket.leave(roomName)
      console.log(`[Socket] ${authSocket.data.senderType}:${authSocket.data.senderId} left room ${roomName}`)
    })

    // Send message
    socket.on('send-message', async (data: SendMessagePayload) => {
      const { appointmentId, text } = data

      if (!text?.trim()) {
        socket.emit('error', { message: 'Сообщение не может быть пустым' })
        return
      }

      // Verify access
      const hasAccess = await verifyAppointmentAccess(
        payload,
        appointmentId,
        authSocket.data.senderType,
        authSocket.data.senderId
      )

      if (!hasAccess) {
        socket.emit('error', { message: 'Нет доступа к этой консультации' })
        return
      }

      try {
        // Save message to database
        const message = await payload.create({
          collection: 'messages',
          data: {
            appointment: appointmentId,
            senderType: authSocket.data.senderType,
            senderId: authSocket.data.senderId,
            text: text.trim(),
            read: false,
          },
          overrideAccess: true,
        })

        const roomName = `appointment:${appointmentId}`

        // Broadcast to all clients in the room (including sender)
        io.to(roomName).emit('new-message', {
          id: message.id,
          appointment: appointmentId,
          senderType: message.senderType,
          senderId: message.senderId,
          text: message.text,
          read: message.read,
          createdAt: message.createdAt,
        })

        console.log(`[Socket] Message sent in room ${roomName} by ${authSocket.data.senderType}:${authSocket.data.senderId}`)
      } catch (err) {
        console.error('[Socket] Failed to save message:', err)
        socket.emit('error', { message: 'Ошибка при отправке сообщения' })
      }
    })

    // Mark messages as read
    socket.on('mark-read', async (data: MarkReadPayload) => {
      const { appointmentId } = data

      // Verify access
      const hasAccess = await verifyAppointmentAccess(
        payload,
        appointmentId,
        authSocket.data.senderType,
        authSocket.data.senderId
      )

      if (!hasAccess) return

      try {
        // Mark all unread messages from the OTHER party as read
        const otherSenderType = authSocket.data.senderType === 'user' ? 'doctor' : 'user'

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
          readBy: authSocket.data.senderType,
        })
      } catch (err) {
        console.error('[Socket] Failed to mark messages as read:', err)
      }
    })

    // Typing indicator
    socket.on('typing', (data: JoinRoomPayload) => {
      const { appointmentId } = data
      const roomName = `appointment:${appointmentId}`
      
      socket.to(roomName).emit('user-typing', {
        appointmentId,
        senderType: authSocket.data.senderType,
        senderId: authSocket.data.senderId,
      })
    })

    socket.on('stop-typing', (data: JoinRoomPayload) => {
      const { appointmentId } = data
      const roomName = `appointment:${appointmentId}`
      
      socket.to(roomName).emit('user-stop-typing', {
        appointmentId,
        senderType: authSocket.data.senderType,
        senderId: authSocket.data.senderId,
      })
    })

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`)
    })
  })

  console.log('[Socket] Socket.IO server initialized')
}
