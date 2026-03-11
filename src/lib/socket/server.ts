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

// [RATE LIMITING] In-memory rate limiter storage
interface RateLimitEntry {
  count: number
  resetAt: number
}
const rateLimitMap = new Map<string, RateLimitEntry>()
const RATE_LIMIT_MAX = 10 // max messages per window
const RATE_LIMIT_WINDOW_MS = 1000 // 1 second window

/**
 * [RATE LIMITING] Check if socket is rate limited
 * Returns true if request should be blocked
 */
function isRateLimited(socketId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(socketId)

  if (!entry || now > entry.resetAt) {
    // New window
    rateLimitMap.set(socketId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return true
  }

  entry.count++
  return false
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

/**
 * Parse cookie string and get value by name
 */
function getCookieValue(cookieString: string, name: string): string | null {
  const match = cookieString.match(new RegExp(`${name}=([^;]+)`))
  return match ? match[1] : null
}

/**
 * [SECURITY FIX] Verify JWT token with signature validation
 * Previously used jwt.decode() which doesn't verify signature - security vulnerability
 */
function verifyToken(token: string): DecodedToken | null {
  try {
    const secret = process.env.PAYLOAD_SECRET
    if (!secret) {
      console.error('[Socket] PAYLOAD_SECRET is not set')
      return null
    }
    // Use jwt.verify() instead of jwt.decode() to validate signature
    return jwt.verify(token, secret) as DecodedToken
  } catch {
    return null
  }
}

/**
 * [INPUT VALIDATION] Validate appointmentId
 */
function isValidAppointmentId(appointmentId: unknown): appointmentId is number {
  return typeof appointmentId === 'number' && Number.isInteger(appointmentId) && appointmentId > 0
}

/**
 * [INPUT VALIDATION] Validate message text
 * Returns sanitized text or null if invalid
 */
function validateMessageText(text: unknown): string | null {
  if (typeof text !== 'string') return null
  const trimmed = text.trim()
  if (trimmed.length === 0) return null
  // Truncate to max 5000 characters
  return trimmed.slice(0, 5000)
}

/**
 * [INPUT VALIDATION] Validate preferredSenderType
 */
function isValidSenderType(senderType: unknown): senderType is 'user' | 'doctor' | undefined {
  return senderType === undefined || senderType === 'user' || senderType === 'doctor'
}

/**
 * [OPTIMIZATION] Verify access and return appointment data for reuse
 * Now returns the appointment object to avoid duplicate DB queries
 */
async function verifyAppointmentAccess(
  payload: Payload,
  appointmentId: number,
  allUserIds: number[],
  allDoctorIds: number[]
): Promise<{ 
  hasAccess: boolean
  accessType?: 'user' | 'doctor'
  accessId?: number
  appointment?: Record<string, unknown> // Return appointment for reuse
}> {
  try {
    const appointment = await payload.findByID({
      collection: 'appointments',
      id: appointmentId,
      overrideAccess: true,
    })

    if (!appointment) return { hasAccess: false }

    // Check if any of the user IDs match
    const appointmentUserId = typeof appointment.user === 'object' 
      ? (appointment.user as { id: number }).id 
      : appointment.user
    for (const userId of allUserIds) {
      if (appointmentUserId === userId) {
        return { hasAccess: true, accessType: 'user', accessId: userId, appointment }
      }
    }

    // Check if any of the doctor IDs match
    const appointmentDoctorId = typeof appointment.doctor === 'object' 
      ? (appointment.doctor as { id: number }).id 
      : appointment.doctor
    for (const doctorId of allDoctorIds) {
      if (appointmentDoctorId === doctorId) {
        return { hasAccess: true, accessType: 'doctor', accessId: doctorId, appointment }
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
  // [RATE LIMITING] Cleanup expired entries every 30 seconds
  const cleanupInterval = setInterval(cleanupRateLimits, 30000)
  
  // Cleanup interval on server shutdown
  io.engine.on('close', () => {
    clearInterval(cleanupInterval)
  })

  // Authentication middleware - collect ALL tokens
  io.use((socket, next) => {
    const cookies = socket.handshake.headers.cookie || ''
    
    const allUserIds: number[] = []
    const allDoctorIds: number[] = []
    let primarySenderType: 'user' | 'doctor' | null = null
    let primarySenderId: number | null = null
    
    // [SECURITY FIX] Use verifyToken instead of decodeToken
    // Try to get user token
    const userToken = getCookieValue(cookies, 'payload-token')
    if (userToken) {
      const decoded = verifyToken(userToken)
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
      const decoded = verifyToken(doctorToken)
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
      typingInRooms: new Set(), // [CLEANUP] Track typing rooms
    }
    
    return next()
  })

  io.on('connection', (socket: Socket) => {
    const authSocket = socket as AuthenticatedSocket
    console.log(`[Socket] Client connected: ${socket.id}, type: ${authSocket.data.senderType}, id: ${authSocket.data.senderId}`)

    // Join room for a specific appointment chat
    socket.on('join-room', async (data: JoinRoomPayload) => {
      const { appointmentId } = data

      // [INPUT VALIDATION] Validate appointmentId
      if (!isValidAppointmentId(appointmentId)) {
        socket.emit('error', { message: 'Некорректный ID консультации' })
        return
      }
      
      // Verify access to the appointment (checks both user and doctor tokens)
      const accessResult = await verifyAppointmentAccess(
        payload,
        appointmentId,
        authSocket.data.allUserIds,
        authSocket.data.allDoctorIds
      )

      if (!accessResult.hasAccess) {
        // [SECURITY LOGGING] Log denied access
        payload.logger.warn(`⚠️ Denied access: socket=${socket.id}, appointment=${appointmentId}`)
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

      // [INPUT VALIDATION] Validate appointmentId
      if (!isValidAppointmentId(appointmentId)) {
        return
      }

      const roomName = `appointment:${appointmentId}`
      socket.leave(roomName)
      
      // [CLEANUP] Remove from typing rooms if was typing
      authSocket.data.typingInRooms.delete(roomName)
      
      console.log(`[Socket] ${authSocket.data.senderType}:${authSocket.data.senderId} left room ${roomName}`)
    })

    // Send message
    socket.on('send-message', async (data: SendMessagePayload) => {
      // [RATE LIMITING] Check rate limit
      if (isRateLimited(socket.id)) {
        socket.emit('error', { message: 'Слишком много запросов' })
        return
      }

      const { appointmentId, text, preferredSenderType } = data

      // [INPUT VALIDATION] Validate all inputs
      if (!isValidAppointmentId(appointmentId)) {
        socket.emit('error', { message: 'Некорректный ID консультации' })
        return
      }

      const validatedText = validateMessageText(text)
      if (!validatedText) {
        socket.emit('error', { message: 'Сообщение не может быть пустым' })
        return
      }

      if (!isValidSenderType(preferredSenderType)) {
        socket.emit('error', { message: 'Некорректный тип отправителя' })
        return
      }

      // [OPTIMIZATION] Verify access and get appointment in one query
      const accessResult = await verifyAppointmentAccess(
        payload,
        appointmentId,
        authSocket.data.allUserIds,
        authSocket.data.allDoctorIds
      )

      if (!accessResult.hasAccess) {
        // [SECURITY LOGGING] Log denied access
        payload.logger.warn(`⚠️ Denied access: socket=${socket.id}, appointment=${appointmentId}`)
        socket.emit('error', { message: 'Нет доступа к этой консультации' })
        return
      }

      // Determine sender type - use preferred if valid, otherwise use detected
      let senderType = accessResult.accessType!
      let senderId = accessResult.accessId!
      
      // [OPTIMIZATION] Reuse appointment from verifyAppointmentAccess instead of fetching again
      if (preferredSenderType && accessResult.appointment) {
        const appointment = accessResult.appointment
        const appointmentUserId = typeof appointment.user === 'object' 
          ? (appointment.user as { id: number }).id 
          : appointment.user as number
        const appointmentDoctorId = typeof appointment.doctor === 'object' 
          ? (appointment.doctor as { id: number }).id 
          : appointment.doctor as number
        
        if (preferredSenderType === 'user' && authSocket.data.allUserIds.includes(appointmentUserId)) {
          senderType = 'user'
          senderId = appointmentUserId
        } else if (preferredSenderType === 'doctor' && authSocket.data.allDoctorIds.includes(appointmentDoctorId)) {
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
        authSocket.data.allUserIds,
        authSocket.data.allDoctorIds
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
        
        if (preferredSenderType === 'user' && authSocket.data.allUserIds.includes(appointmentUserId)) {
          actualSenderType = 'user'
        } else if (preferredSenderType === 'doctor' && authSocket.data.allDoctorIds.includes(appointmentDoctorId)) {
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
        authSocket.data.allUserIds,
        authSocket.data.allDoctorIds
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
        authSocket.data.allUserIds,
        authSocket.data.allDoctorIds
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
