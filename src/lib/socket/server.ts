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
    // Store both IDs for access verification when user has both tokens
    allUserIds: number[]
    allDoctorIds: number[]
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
 * Checks both user and doctor tokens if available
 */
async function verifyAppointmentAccess(
  payload: Payload,
  appointmentId: number,
  allUserIds: number[],
  allDoctorIds: number[]
): Promise<{ hasAccess: boolean; accessType?: 'user' | 'doctor'; accessId?: number }> {
  try {
    const appointment = await payload.findByID({
      collection: 'appointments',
      id: appointmentId,
      overrideAccess: true,
    })

    if (!appointment) return { hasAccess: false }

    // Check if any of the user IDs match
    const appointmentUserId = typeof appointment.user === 'object' ? appointment.user.id : appointment.user
    for (const userId of allUserIds) {
      if (appointmentUserId === userId) {
        return { hasAccess: true, accessType: 'user', accessId: userId }
      }
    }

    // Check if any of the doctor IDs match
    const appointmentDoctorId = typeof appointment.doctor === 'object' ? appointment.doctor.id : appointment.doctor
    for (const doctorId of allDoctorIds) {
      if (appointmentDoctorId === doctorId) {
        return { hasAccess: true, accessType: 'doctor', accessId: doctorId }
      }
    }

    return { hasAccess: false }
  } catch {
    return { hasAccess: false }
  }
}

/**
 * Initialize Socket.IO server with event handlers
 */
export function initializeSocketServer(io: SocketIOServer, payload: Payload) {
  // Authentication middleware - collect ALL tokens
  io.use((socket, next) => {
    const cookies = socket.handshake.headers.cookie || ''
    
    const allUserIds: number[] = []
    const allDoctorIds: number[] = []
    let primarySenderType: 'user' | 'doctor' | null = null
    let primarySenderId: number | null = null
    
    // Try to get user token
    const userToken = getCookieValue(cookies, 'payload-token')
    if (userToken) {
      const decoded = decodeToken(userToken)
      if (decoded?.id) {
        allUserIds.push(decoded.id)
        // Default to user if both exist
        primarySenderType = 'user'
        primarySenderId = decoded.id
      }
    }

    // Try doctor token - always check regardless of user token
    const doctorToken = getCookieValue(cookies, 'doctors-token')
    if (doctorToken) {
      const decoded = decodeToken(doctorToken)
      if (decoded?.id) {
        allDoctorIds.push(decoded.id)
        // Override to doctor if no user, or keep user as primary
        if (!primarySenderType) {
          primarySenderType = 'doctor'
          primarySenderId = decoded.id
        }
      }
    }

    // Require at least one valid token
    if (!primarySenderType || !primarySenderId) {
      return next(new Error('Authentication required'))
    }

    ;(socket as AuthenticatedSocket).data = {
      userId: allUserIds[0],
      doctorId: allDoctorIds[0],
      senderType: primarySenderType,
      senderId: primarySenderId,
      allUserIds,
      allDoctorIds,
    }
    
    return next()
  })

  io.on('connection', (socket: Socket) => {
    const authSocket = socket as AuthenticatedSocket
    console.log(`[Socket] Client connected: ${socket.id}, type: ${authSocket.data.senderType}, id: ${authSocket.data.senderId}`)

    // Join room for a specific appointment chat
    socket.on('join-room', async (data: JoinRoomPayload) => {
      const { appointmentId } = data
      
      // Verify access to the appointment (checks both user and doctor tokens)
      const accessResult = await verifyAppointmentAccess(
        payload,
        appointmentId,
        authSocket.data.allUserIds,
        authSocket.data.allDoctorIds
      )

      if (!accessResult.hasAccess) {
        socket.emit('error', { message: 'Нет доступа к этой консультации' })
        return
      }

      const roomName = `appointment:${appointmentId}`
      socket.join(roomName)
      console.log(`[Socket] ${accessResult.accessType}:${accessResult.accessId} joined room ${roomName}`)
      
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
      const { appointmentId, text, preferredSenderType } = data

      if (!text?.trim()) {
        socket.emit('error', { message: 'Сообщение не может быть пустым' })
        return
      }

      // Verify access (checks both user and doctor tokens)
      const accessResult = await verifyAppointmentAccess(
        payload,
        appointmentId,
        authSocket.data.allUserIds,
        authSocket.data.allDoctorIds
      )

      if (!accessResult.hasAccess) {
        socket.emit('error', { message: 'Нет доступа к этой консультации' })
        return
      }

      // Determine sender type - use preferred if valid, otherwise use detected
      let senderType = accessResult.accessType!
      let senderId = accessResult.accessId!
      
      // If client specifies a preferred sender type, validate and use it
      if (preferredSenderType) {
        // Check if the user can act as the preferred type for this appointment
        try {
          const appointment = await payload.findByID({
            collection: 'appointments',
            id: appointmentId,
            overrideAccess: true,
          })
          
          if (appointment) {
            const appointmentUserId = typeof appointment.user === 'object' ? appointment.user.id : appointment.user
            const appointmentDoctorId = typeof appointment.doctor === 'object' ? appointment.doctor.id : appointment.doctor
            
            if (preferredSenderType === 'user' && authSocket.data.allUserIds.includes(appointmentUserId)) {
              senderType = 'user'
              senderId = appointmentUserId
            } else if (preferredSenderType === 'doctor' && authSocket.data.allDoctorIds.includes(appointmentDoctorId)) {
              senderType = 'doctor'
              senderId = appointmentDoctorId
            }
          }
        } catch {
          // Use default access result on error
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

        console.log(`[Socket] Message sent in room ${roomName} by ${senderType}:${senderId}`)
      } catch (err) {
        console.error('[Socket] Failed to save message:', err)
        socket.emit('error', { message: 'Ошибка при отправке сообщения' })
      }
    })

    // Mark messages as read
    socket.on('mark-read', async (data: MarkReadPayload) => {
      const { appointmentId, preferredSenderType } = data

      // Verify access (checks both user and doctor tokens)
      const accessResult = await verifyAppointmentAccess(
        payload,
        appointmentId,
        authSocket.data.allUserIds,
        authSocket.data.allDoctorIds
      )

      if (!accessResult.hasAccess) return

      // Determine the actual sender type
      let actualSenderType = accessResult.accessType!
      
      // If client specifies preferred type, validate and use it
      if (preferredSenderType) {
        try {
          const appointment = await payload.findByID({
            collection: 'appointments',
            id: appointmentId,
            overrideAccess: true,
          })
          
          if (appointment) {
            const appointmentUserId = typeof appointment.user === 'object' ? appointment.user.id : appointment.user
            const appointmentDoctorId = typeof appointment.doctor === 'object' ? appointment.doctor.id : appointment.doctor
            
            if (preferredSenderType === 'user' && authSocket.data.allUserIds.includes(appointmentUserId)) {
              actualSenderType = 'user'
            } else if (preferredSenderType === 'doctor' && authSocket.data.allDoctorIds.includes(appointmentDoctorId)) {
              actualSenderType = 'doctor'
            }
          }
        } catch {
          // Use default access result on error
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

    // Typing indicator
    socket.on('typing', (data: JoinRoomPayload) => {
      const { appointmentId, preferredSenderType } = data
      const roomName = `appointment:${appointmentId}`
      
      // Use preferred sender type if provided, otherwise use default
      const senderType = preferredSenderType || authSocket.data.senderType
      const senderId = senderType === 'user' ? authSocket.data.userId : authSocket.data.doctorId
      
      socket.to(roomName).emit('user-typing', {
        appointmentId,
        senderType,
        senderId: senderId || authSocket.data.senderId,
      })
    })

    socket.on('stop-typing', (data: JoinRoomPayload) => {
      const { appointmentId, preferredSenderType } = data
      const roomName = `appointment:${appointmentId}`
      
      // Use preferred sender type if provided, otherwise use default  
      const senderType = preferredSenderType || authSocket.data.senderType
      const senderId = senderType === 'user' ? authSocket.data.userId : authSocket.data.doctorId
      
      socket.to(roomName).emit('user-stop-typing', {
        appointmentId,
        senderType,
        senderId: senderId || authSocket.data.senderId,
      })
    })

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`)
    })
  })

  console.log('[Socket] Socket.IO server initialized')
}
