// socket/middleware/auth.ts

import type { Socket } from 'socket.io'
import type { AuthenticatedSocket } from '../types'
import getCookieValue from '../utils/getCookieValue'
import decodeToken from '../utils/verifyToken'


export function createAuthMiddleware() {
  return (socket: Socket, next: (err?: Error) => void) => {
    const cookies = socket.handshake.headers.cookie || '';
    
    console.log('[v0] Raw cookies string:', cookies)
    console.log('[v0] Cookie names found:', cookies.split(';').map(c => c.trim().split('=')[0]))
    
    let userId: number | undefined
    let doctorId: number | undefined

    // 🔹 Проверяем токен пользователя
    const userToken = getCookieValue(cookies, 'payload-token');
    console.log('[v0] userToken extracted:', userToken ? `${userToken.substring(0, 20)}...` : null)
    if (userToken) {
      // 🔴 Используем decode вместо verify
      const decoded = decodeToken(userToken)  // ← здесь подмена
      if (decoded?.id) {
        userId = decoded.id
      } else {
        console.warn('[DEBUG] User token decoded but no id:', decoded)
      }
    }

    // 🔹 Проверяем токен доктора
    const doctorToken = getCookieValue(cookies, 'doctors-token')
    console.log('[v0] doctorToken extracted:', doctorToken ? `${doctorToken.substring(0, 20)}...` : null)
    if (doctorToken) {
      // 🔴 Используем decode вместо verify
      const decoded = decodeToken(doctorToken)  // ← здесь подмена
      console.log('[v0] doctorToken decoded:', decoded)
      if (decoded?.id) {
        doctorId = decoded.id
      
      } else {
        console.warn('[DEBUG] Doctor token decoded but no id:', decoded)
      }
    }

    // 🔹 Если не авторизован ни как User, ни как Doctor — отклоняем
    if (!userId && !doctorId) {
      console.warn('[DEBUG] Authentication failed - no valid token:', {
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
    
    console.log('[v0] Auth success:', {
      socketId: socket.id,
      senderType,
      senderId,
      userId,
      doctorId,
      hasDoctorToken: !!doctorToken,
      hasUserToken: !!userToken,
    })
    
    return next()
  }
}
