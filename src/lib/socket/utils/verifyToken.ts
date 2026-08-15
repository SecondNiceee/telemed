import jwt from 'jsonwebtoken'
import { getPayloadJwtSecret } from '@/lib/server/payload-jwt-secret'

interface DecodedToken {
  id: number
  email?: string
  collection?: string
  role?: string
  exp?: number
  iat?: number
}

/**
 * Проверяет подпись токена из cookie и возвращает payload.
 *
 * Раньше здесь стоял jwt.decode() «для отладки» — подпись не проверялась вовсе,
 * потому что jwt.verify(token, process.env.PAYLOAD_SECRET) всегда падал:
 * Payload подписывает токены производным ключом, см. getPayloadJwtSecret().
 */
export default function verifyToken(token: string): DecodedToken | null {
  const secret = getPayloadJwtSecret()
  if (!secret) {
    console.error('[Socket] PAYLOAD_SECRET is not set')
    return null
  }

  try {
    return jwt.verify(token, secret) as DecodedToken
  } catch (err) {
    console.error('[Socket] Verify error:', err)
    return null
  }
}
