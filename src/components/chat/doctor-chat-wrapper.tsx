'use client'

import { useEffect } from 'react'
import { ChatPage } from './chat-page'
import { useDoctorAppointmentStore } from '@/stores/doctor-appointments-store'
import { useDoctorStore } from '@/stores/doctor-store'
import type { ApiAppointment, ApiDoctor } from '@/lib/api/types'

interface DoctorChatWrapperProps {
  appointments: ApiAppointment[]
  doctorId: number
  initialAppointmentId: number | null
  initialDoctor: ApiDoctor
}

export function DoctorChatWrapper({
  appointments,
  doctorId,
  initialAppointmentId,
  initialDoctor,
}: DoctorChatWrapperProps) {
  const { updateAppointmentStatus } = useDoctorAppointmentStore()
  const setDoctor = useDoctorStore((s) => s.setDoctor)
  const storeDoctor = useDoctorStore((s) => s.doctor)

  console.log('[DoctorChatWrapper] Render - initialDoctor:', initialDoctor?.id, 'storeDoctor:', storeDoctor?.id)

  // Sync server-side doctor to client store for VideoCallProvider
  // Always sync if initialDoctor exists and differs from storeDoctor
  useEffect(() => {
    console.log('[DoctorChatWrapper] useEffect running - initialDoctor:', initialDoctor?.id)
    if (initialDoctor) {
      console.log('[DoctorChatWrapper] Syncing doctor to store:', initialDoctor.id)
      setDoctor(initialDoctor)
    }
  }, [initialDoctor, setDoctor])

  const handleAppointmentCompleted = (appointmentId: number) => {
    updateAppointmentStatus(appointmentId, 'completed')
  }

  return (
    <ChatPage
      appointments={appointments}
      currentSenderType="doctor"
      currentSenderId={doctorId}
      initialAppointmentId={initialAppointmentId}
      onAppointmentCompleted={handleAppointmentCompleted}
    />
  )
}
