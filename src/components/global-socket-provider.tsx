'use client'

import type { ReactNode } from 'react'
import { SocketProvider } from '@/components/socket-provider'
import { useDoctorStore } from '@/stores/doctor-store'
import { useUserStore } from '@/stores/user-store'

export function GlobalSocketProvider({ children }: { children: ReactNode }) {
  const user = useUserStore((state) => state.user)
  const doctor = useDoctorStore((state) => state.doctor)
  const currentSenderType = doctor ? 'doctor' : user ? 'user' : undefined
  const currentSenderId = doctor?.id ?? user?.id ?? undefined

  return (
    <SocketProvider currentSenderType={currentSenderType} currentSenderId={currentSenderId}>
      {children}
    </SocketProvider>
  )
}
