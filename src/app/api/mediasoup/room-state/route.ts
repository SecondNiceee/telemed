import config from '@payload-config'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { signRoomToken } from '@/lib/mediasoup/room-token'
import { getPayloadJwtSecret } from '@/lib/server/payload-jwt-secret'

interface SessionClaims extends jwt.JwtPayload {
  id: number | string
  collection: 'users' | 'doctors'
}

function relationshipId(value: unknown): string {
  if (typeof value === 'object' && value !== null && 'id' in value) return String(value.id)
  return String(value)
}

/**
 * Сообщает, есть ли в комнате консультации второй участник.
 *
 * Нужно участнику, который вернулся на страницу звонка по старой ссылке
 * (например, после закрытия браузера): по одному URL нельзя понять, идёт
 * звонок или всё давно закончилось.
 */
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
        // Пробуем другую поддерживаемую сессионную куку.
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

    const peerId = `${role}-${session.id}`
    const roomId = `appointment_${appointmentId}`
    const token = signRoomToken({
      appointmentId,
      roomId,
      peerId,
      userId: String(session.id),
      role,
      peerName: (role === 'doctor' ? appointment.doctorName : appointment.userName) || (role === 'doctor' ? 'Врач' : 'Пациент'),
    })

    // Обращаемся к медиасерверу напрямую, а НЕ по публичному
    // NEXT_PUBLIC_MEDIASOUP_URL: снаружи обратный прокси пропускает только путь
    // socket.io, поэтому публичный запрос на /rooms/... до медиасервера не
    // доходит и проверка всегда падала бы в ошибку.
    const baseUrl = (process.env.MEDIASOUP_INTERNAL_URL || `http://127.0.0.1:${process.env.MEDIASOUP_PORT || '3002'}`).replace(/\/$/, '')
    const response = await fetch(`${baseUrl}/rooms/${roomId}/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, peerId }),
      cache: 'no-store',
      // Медиасервер отвечает из памяти, так что ожидание здесь - признак того,
      // что он недоступен. Лучше быстро вернуть ошибку, чем держать клиента.
      signal: AbortSignal.timeout(5000),
    })
    const state = await response.json() as { success?: boolean; roomExists?: boolean; otherPeerPresent?: boolean }
    if (!response.ok || state.success !== true) {
      return NextResponse.json({ success: false, error: 'Unable to read room state' }, { status: 502 })
    }

    return NextResponse.json({
      success: true,
      roomExists: state.roomExists === true,
      otherPeerPresent: state.otherPeerPresent === true,
    })
  } catch (error) {
    console.error('[MediaSoup RoomState] Failed to read room state:', error)
    return NextResponse.json({ success: false, error: 'Unable to read room state' }, { status: 502 })
  }
}
