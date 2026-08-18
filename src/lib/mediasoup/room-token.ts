import jwt from 'jsonwebtoken'
import type { PeerRole } from './peer'

const TOKEN_TTL_SECONDS = 5 * 60

export interface RoomTokenClaims extends jwt.JwtPayload {
  purpose: 'mediasoup-room'
  appointmentId: number
  roomId: string
  peerId: string
  userId: string
  role: PeerRole
  peerName: string
}

function getSecret(): string {
  const secret = process.env.MEDIASOUP_SERVER_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('MEDIASOUP_SERVER_SECRET must be configured with at least 32 characters')
  }
  return secret
}

export function signRoomToken(claims: Omit<RoomTokenClaims, keyof jwt.JwtPayload | 'purpose'>): string {
  return jwt.sign(
    { ...claims, purpose: 'mediasoup-room' },
    getSecret(),
    { algorithm: 'HS256', expiresIn: TOKEN_TTL_SECONDS },
  )
}

export function verifyRoomToken(token: string, expected?: { roomId?: string; peerId?: string }): RoomTokenClaims {
  const claims = jwt.verify(token, getSecret(), { algorithms: ['HS256'] }) as RoomTokenClaims
  if (claims.purpose !== 'mediasoup-room') throw new Error('Invalid room token purpose')
  if (!/^appointment_\d+$/.test(claims.roomId)) throw new Error('Invalid room token room')
  if (claims.roomId !== `appointment_${claims.appointmentId}`) throw new Error('Room token appointment mismatch')
  if (expected?.roomId && claims.roomId !== expected.roomId) throw new Error('Room token does not grant access to this room')
  if (expected?.peerId && claims.peerId !== expected.peerId) throw new Error('Room token does not grant access to this peer')
  return claims
}
