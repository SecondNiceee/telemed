// socket/middleware/auth.ts

import type { Socket } from 'socket.io'
import type { AuthenticatedSocket } from '../types'
import getCookieValue from '../utils/getCookieValue'
import verifyToken from '../utils/verifyToken'


export function createAuthMiddleware() {
  return (socket: Socket, next: (err?: Error) => void) => {
    const cookies = socket.handshake.headers.cookie || '';
    
    let userId: number | undefined
    let doctorId: number | undefined

    // 🔹 Проверяем токен пользователя
    const userToken = getCookieValue(cookies, 'payload-token');
    if (userToken) {
      const decoded = verifyToken(userToken)
      if (decoded?.id) {
        userId = decoded.id
      }
    }

    // 🔹 Проверяем токен доктора
    const doctorToken = getCookieValue(cookies, 'doctors-token')
    if (doctorToken) {
      const decoded = verifyToken(doctorToken)
      if (decoded?.id) {
        doctorId = decoded.id
      }
    }

    // 🔹 Если не авторизован ни как User, ни как Doctor — отклоняем
    if (!userId && !doctorId) {
      console.warn('[Socket] Authentication failed - no valid token:', {
        hasUserToken: !!userToken,
        hasDoctorToken: !!doctorToken,
      })
      return next(new Error('Authentication required'))
    }

    // Определяем тип отправителя и его ID
    const senderType: 'doctor' | 'user' = doctorId ? 'doctor' : 'user'
    const senderId = doctorId ?? userId
    
    // Гарантируем что senderId есть (проверка выше уже это подтвердила)
    if (!senderId) {
      return next(new Error('Authentication required'))
    }

    // 🔹 Сохраняем данные в сокет
    ;(socket as AuthenticatedSocket).data = {
      senderType,
      senderId,
      userId,
      doctorId,
      typingInRooms: new Set(),
    }
    
    return next()
  }
}
