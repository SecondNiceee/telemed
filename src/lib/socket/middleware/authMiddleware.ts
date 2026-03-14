import type { Socket } from 'socket.io'
import getCookieValue from '../utils/getCookieValue'
import verifyToken from '../utils/verifyToken'

interface AuthenticatedSocket extends Socket {
  data: {
    userId?: number
    doctorId?: number
    senderType: 'user' | 'doctor'
    senderId: number
    typingInRooms: Set<string>
  }
}

export function createAuthMiddleware() {
  return (socket: Socket, next: (err?: Error) => void) => {
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
  }
}
