// socket/middleware/auth.ts

import type { Socket } from 'socket.io'
import getCookieValue from '../utils/getCookieValue'
import decodeToken from '../utils/verifyToken'
// 🔴 Временно меняем импорт:


interface AuthenticatedSocket extends Socket 
   {
    userId?: number
    doctorId?: number
    senderType: 'user' | 'doctor'
    senderId: number
    typingInRooms: Set<string>
  }


export function createAuthMiddleware() {
  return (socket: Socket, next: (err?: Error) => void) => {
    const cookies = socket.handshake.headers.cookie || ''
    
    let userId: number | undefined
    let doctorId: number | undefined
    let primarySenderType: 'user' | 'doctor' | null = null
    let primarySenderId: number | null = null

    // 🔹 Проверяем токен пользователя
    const userToken = getCookieValue(cookies, 'payload-token')
    if (userToken) {
      // 🔴 Используем decode вместо verify
      const decoded = decodeToken(userToken)  // ← здесь подмена
      if (decoded?.id) {
        userId = decoded.id
        primarySenderType = 'user'
        primarySenderId = decoded.id
        
        // 🐞 Лог для отладки
        console.log('[DEBUG] User token accepted:', { userId, primarySenderType })
      } else {
        console.warn('[DEBUG] User token decoded but no id:', decoded)
      }
    }

    // 🔹 Проверяем токен доктора
    const doctorToken = getCookieValue(cookies, 'doctors-token')
    if (doctorToken) {
      // 🔴 Используем decode вместо verify
      const decoded = decodeToken(doctorToken)  // ← здесь подмена
      if (decoded?.id) {
        doctorId = decoded.id
        if (!primarySenderType) {
          primarySenderType = 'doctor'
          primarySenderId = decoded.id
        }
        
        // 🐞 Лог для отладки
        console.log('[DEBUG] Doctor token accepted:', { doctorId, primarySenderType })
      } else {
        console.warn('[DEBUG] Doctor token decoded but no id:', decoded)
      }
    }

    // 🔹 Если не авторизован — отклоняем
    if (!primarySenderType || !primarySenderId) {
      console.warn('[DEBUG] Authentication failed:', {
        hasUserToken: !!userToken,
        hasDoctorToken: !!doctorToken,
        userId,
        doctorId,
        primarySenderType,
      })
      return next(new Error('Authentication required'))
    }

    // 🔹 Сохраняем данные в сокет
    ;(socket as AuthenticatedSocket).data = {
      userId,
      doctorId,
      senderType: primarySenderType,
      senderId: primarySenderId,
      typingInRooms: new Set(),
    }
    
    console.log('[DEBUG] Auth success:', {
      socketId: socket.id,
      userId,
      doctorId,
      senderType: primarySenderType,
    })
    
    return next()
  }
}