import { notFound } from 'next/navigation'
import { CallRoom } from './call-room'

export default async function AppointmentCallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const appointmentId = Number(id)
  if (!Number.isInteger(appointmentId) || appointmentId <= 0) notFound()
  return <CallRoom appointmentId={appointmentId} />
}
