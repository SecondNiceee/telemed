"use client"

import { CalendarX } from "lucide-react"
import Link from "next/link"
import type { ApiAppointment } from "@/lib/api/types"
import { Button } from "@/components/ui/button"
import { User } from "@/payload-types"
import { UserHeroBanner } from "@/components/user-hero-banner"
import { UserAppointmentCard } from "@/components/user-appointment-card"
import { AuthApi } from "@/lib/api/auth"
import { toast } from "sonner"

interface LkContentProps {
  user: User
  appointments: ApiAppointment[]
}

export function LkContent({ user, appointments }: LkContentProps) {
  const confirmed = appointments.filter((a) => a.status === "confirmed").length
  const completed = appointments.filter((a) => a.status === "completed").length

  const handleLogout = async () => {
    try {
      await AuthApi.logout()
      toast.success("Вы успешно вышли из аккаунта")
      setTimeout(() => {
        window.location.href = process.env.NEXT_PUBLIC_BASE_PATH || "/"
      }, 500)
    } catch {
      toast.error("Ошибка при выходе")
    }
  }

  return (
    <div className="flex-1 bg-background">
      {/* Hero banner */}
      <UserHeroBanner
        user={user}
        confirmedCount={confirmed}
        completedCount={completed}
        onLogout={handleLogout}
      />

      {/* Appointments list */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-base font-semibold text-foreground mb-4">Мои записи</h2>

        {appointments.length === 0 ? (
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
