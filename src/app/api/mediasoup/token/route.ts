import config from '@payload-config'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { getIceServers } from '@/lib/mediasoup/ice-servers'
import { signRoomToken } from '@/lib/mediasoup/room-token'
import { getPayloadJwtSecret } from '@/lib/server/payload-jwt-secret'

interface SessionClaims extends jwt.JwtPayload {
  id: number | string
  collection: 'users' | 'doctors'
  email?: string
}

function relationshipId(value: unknown): string {
  if (typeof value === 'object' && value !== null && 'id' in value) return String(value.id)
  return String(value)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { appointmentId?: unknown }
    const appointmentId = Number(body.appointmentId)
    if (!Number.isInteger(appointmentId) || appointmentId <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid appointment ID' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const sessions = [
      { token: cookieStore.get('doctors-token')?.value, collection: 'doctors' as const },
      { token: cookieStore.get('payload-token')?.value, collection: 'users' as const },
    ]
    const payloadSecret = getPayloadJwtSecret()
    if (!payloadSecret) throw new Error('Payload JWT secret is not configured')

    let session: SessionClaims | null = null
    for (const candidate of sessions) {
      if (!candidate.token) continue
      try {
        const decoded = jwt.verify(candidate.token, payloadSecret) as SessionClaims
        if (decoded.collection === candidate.collection) {
          session = decoded
          break
        }
      } catch {
        // Try the other supported session cookie.
      }
    }

    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await getPayload({ config })
    const appointment = await payload.findByID({
      collection: 'appointments',
      id: appointmentId,
      depth: 0,
      overrideAccess: true,
    })

    const role = session.collection === 'doctors' ? 'doctor' : 'patient'
    const participantId = role === 'doctor' ? relationshipId(appointment.doctor) : relationshipId(appointment.user)
    if (participantId !== String(session.id)) {
      return NextResponse.json({ success: false, error: 'Appointment access denied' }, { status: 403 })
    }

    if (appointment.status === 'cancelled' || appointment.status === 'pending_payment') {
      return NextResponse.json({ success: false, error: 'Appointment is not available for a call' }, { status: 403 })
    }

    const peerId = `${role}-${session.id}`
    const peerName = role === 'doctor' ? appointment.doctorName : appointment.userName
    const roomId = `appointment_${appointmentId}`
    const token = signRoomToken({
      appointmentId,
      roomId,
      peerId,
      userId: String(session.id),
      role,
      peerName: peerName || (role === 'doctor' ? 'Врач' : 'Пациент'),
    })

    return NextResponse.json({
      success: true,
      token,
      roomId,
      peerId,
      role,
      peerName,
      iceServers: getIceServers(),
    })
  } catch (error) {
    console.error('[MediaSoup Token] Failed to issue room token:', error)
    return NextResponse.json({ success: false, error: 'Unable to issue room token' }, { status: 500 })
  }
}
