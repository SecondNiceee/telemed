// utils/verifyToken.ts (или создай новый файл decodeToken.ts)

import jwt from 'jsonwebtoken'

interface DecodedToken {
  id: number
  email?: string
  collection?: string
  role?: string
  exp?: number  // ← Добавь, если хочешь видеть срок действия
  iat?: number  // ← Время выдачи
}

// 🔴 ВРЕМЕННО ДЛЯ ОТЛАДКИ: используем decode вместо verify
export default function decodeToken(token: string): DecodedToken | null {
  try {
    // 🔓 jwt.decode() НЕ проверяет подпись — просто читает payload
    const decoded = jwt.decode(token) as DecodedToken | null
    
    // 🐞 Добавим логирование, чтобы видеть, что именно приходит
    if (decoded) {
      console.log('[DEBUG] Decoded token:', {
        id: decoded.id,
        email: decoded.email,
        collection: decoded.collection,
        role: decoded.role,
        exp: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : undefined,
      })
    } else {
      console.warn('[DEBUG] Token could not be decoded')
    }
    
    return decoded
  } catch (err) {
    console.error('[DEBUG] Decode error:', err)
    return null
  }
}

// ✅ Оставь оригинальную функцию закомментированной (для быстрого возврата)
/*
export default function verifyToken(token: string): DecodedToken | null {
  try {
    const secret = process.env.PAYLOAD_SECRET
    if (!secret) {
      console.error('[Socket] PAYLOAD_SECRET is not set')
      return null
    }
    return jwt.verify(token, secret) as DecodedToken
  } catch (err) {
    console.error('[Socket] Verify error:', err)
    return null
  }
}
*/