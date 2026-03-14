import jwt from 'jsonwebtoken';
// Верифицирую токен Payload 
interface DecodedToken {
    id: number
    email?: string
    collection?: string
    role?: string
  }
export default function verifyToken(token: string): DecodedToken | null {
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