import config from '@payload-config'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import { getPayloadJwtSecret } from '@/lib/server/payload-jwt-secret'
import { CallRoom } from './call-room'

type ParticipantCollection = 'users' | 'doctors'
type SessionClaims = jwt.JwtPayload & { id: number | string; collection: ParticipantCollection }

function relationshipId(value: unknown): string {
  if (typeof value === 'object' && value !== null && 'id' in value) return String(value.id)
  return String(value)
}

function relationshipName(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || !('name' in value)) return null
  return typeof value.name === 'string' && value.name.trim() ? value.name.trim() : null
}

async function getParticipantSession(): Promise<SessionClaims | null> {
  const cookieStore = await cookies()
  const candidates = [
    { token: cookieStore.get('doctors-token')?.value, collection: 'doctors' as const },
    { token: cookieStore.get('payload-token')?.value, collection: 'users' as const },
  ]
  const secret = getPayloadJwtSecret()
  if (!secret) return null

  for (const candidate of candidates) {
    if (!candidate.token) continue
    try {
      const decoded = jwt.verify(candidate.token, secret) as SessionClaims
      if (decoded.collection === candidate.collection) return decoded
    } catch {
      // Try the other supported participant cookie.
    }
  }
  return null
}

export default async function AppointmentCallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const appointmentId = Number(id)
  if (!Number.isInteger(appointmentId) || appointmentId <= 0) notFound()

  const session = await getParticipantSession()
  if (!session) notFound()

  const payload = await getPayload({ config })
  const appointment = await payload.findByID({
    collection: 'appointments',
    id: appointmentId,
    depth: 1,
    overrideAccess: true,
  }).catch(() => null)
  if (!appointment) notFound()

  const isDoctor = session.collection === 'doctors' && relationshipId(appointment.doctor) === String(session.id)
  const isPatient = session.collection === 'users' && relationshipId(appointment.user) === String(session.id)
  if (!isDoctor && !isPatient) notFound()

  const doctorName = relationshipName(appointment.doctor) ?? appointment.doctorName?.trim() ?? 'Врач'
  const patientName = relationshipName(appointment.user) ?? appointment.userName?.trim() ?? 'Пациент'

  return (
    <CallRoom
      appointmentId={appointmentId}
      chatPath={isDoctor ? '/lk-med/chat' : '/lk/chat'}
      localParticipantName={isDoctor ? doctorName : patientName}
      remoteParticipantName={isDoctor ? patientName : doctorName}
      // Запись ведётся только в браузере врача, поэтому пациент id не получает.
      recordingDoctorId={isDoctor ? Number(relationshipId(appointment.doctor)) : null}
    />
  )
}
