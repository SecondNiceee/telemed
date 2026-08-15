"use client"

// ВРЕМЕННЫЙ клиент для визуальной проверки редизайна /lk без БД.
import { useEffect, useState } from "react"
import { LkContent } from "@/components/lk-content"
import { useUserStore } from "@/stores/user-store"
import { useUserAppointmentStore } from "@/stores/user-appointments-store"
import type { ApiAppointment } from "@/lib/api/types"
import type { User } from "@/payload-types"

export function PreviewClient({
  user,
  appointments,
}: {
  user: User
  appointments: ApiAppointment[]
}) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    useUserStore.setState({ user, fetched: true, loading: false })
    useUserAppointmentStore.setState({
      appointments,
      fetched: true,
      loading: false,
    })
    setReady(true)
  }, [user, appointments])

  if (!ready) return null

  return <LkContent user={user} appointments={appointments} />
}
