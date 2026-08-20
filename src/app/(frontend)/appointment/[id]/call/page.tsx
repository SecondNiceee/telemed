import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getSessionFromCookie } from '@/lib/auth/getSessionFromCookie'
import type { ApiDoctor } from '@/lib/api/types'
import { CallRoom } from './call-room'

export default async function AppointmentCallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const appointmentId = Number(id)
  if (!Number.isInteger(appointmentId) || appointmentId <= 0) notFound()

  const requestHeaders = await headers()
  const doctor = await getSessionFromCookie<ApiDoctor>(requestHeaders, 'doctors-token', 'doctors')
  const chatPath = doctor ? '/lk-med/chat' : '/lk/chat'

  return <CallRoom appointmentId={appointmentId} chatPath={chatPath} />
}
