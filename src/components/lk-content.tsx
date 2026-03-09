"use client"

import { useEffect } from "react"
import { useUserStore } from "@/stores/user-store"
import { useUserAppointmentStore } from "@/stores/user-appointments-store"
import { CalendarX } from "lucide-react"
import Link from "next/link"
import type { ApiAppointment } from "@/lib/api/types"
import { Button } from "@/components/ui/button"
import { User } from "@/payload-types"
import { UserHeroBanner } from "@/components/user-hero-banner"
import { UserAppointmentCard } from "@/components/user-appointment-card"

interface LkContentProps {
  user: User | null
  appointments: ApiAppointment[]
}

export function LkContent({ user, appointments: serverAppointments }: LkContentProps) {
  const { loading: userLoading, setUser, user: storeUser, fetched: userFetched, logout } = useUserStore()
  const { appointments, setAppointments, loading: apptLoading, fetched: apptFetched } = useUserAppointmentStore()

  // Sync user to store
  useEffect(() => {
    if (!storeUser && user) {
      setUser(user)
    }
  }, [storeUser, user, setUser])

  // Sync server-loaded appointments to store
  useEffect(() => {
    if (serverAppointments.length > 0 && !apptFetched) {
      setAppointments(serverAppointments)
    }
  }, [serverAppointments, apptFetched, setAppointments])

  if (!userFetched || userLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!user) return null

  const isLoading = apptLoading && !apptFetched
  const confirmed = appointments.filter((a) => a.status === "confirmed").length
  const completed = appointments.filter((a) => a.status === "completed").length

  return (
    <div className="flex-1 bg-background">
      {/* Hero banner */}
      <UserHeroBanner
        user={user}
        confirmedCount={confirmed}
        completedCount={completed}
        onLogout={logout}
      />

      {/* Appointments list */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-base font-semibold text-foreground mb-4">Мои записи</h2>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : appointments.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-10 flex flex-col items-center justify-center text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
              <CalendarX className="w-7 h-7 text-muted-foreground" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">У вас нет записей</p>
              <p className="text-sm text-muted-foreground mt-1">
                Запишитесь на приём к специалисту на главной странице
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/">Найти врача</Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {appointments.map((appt) => (
              <UserAppointmentCard key={appt.id} appointment={appt} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
