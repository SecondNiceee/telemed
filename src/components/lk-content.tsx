"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useUserStore } from "@/stores/user-store"
import { AppointmentsApi } from "@/lib/api/appointments"
import type { ApiAppointment } from "@/lib/api/types"
import { CalendarX, Calendar, Clock, User2 } from "lucide-react"
import { Button } from "@/components/ui/button"

const statusLabels: Record<string, { label: string; className: string }> = {
  scheduled: {
    label: "Запланирована",
    className: "bg-primary/10 text-primary",
  },
  completed: {
    label: "Завершена",
    className: "bg-muted text-muted-foreground",
  },
  cancelled: {
    label: "Отменена",
    className: "bg-destructive/10 text-destructive",
  },
}

export function LkContent() {
  const router = useRouter()
  const { user, loading, fetched, fetchUser } = useUserStore()
  const [appointments, setAppointments] = useState<ApiAppointment[]>([])
  const [appointmentsLoading, setAppointmentsLoading] = useState(false)

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  useEffect(() => {
    if (fetched && !user) {
      router.replace("/")
    }
  }, [fetched, user, router])

  useEffect(() => {
    if (user) {
      setAppointmentsLoading(true)
      AppointmentsApi.fetchMyAppointments()
        .then((data) => setAppointments(data))
        .catch(() => setAppointments([]))
        .finally(() => setAppointmentsLoading(false))
    }
  }, [user])

  if (!fetched || loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="flex-1">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <p className="text-sm text-muted-foreground">Личный кабинет</p>
          <h1 className="text-2xl font-semibold text-foreground mt-1">
            {user.name || user.email}
          </h1>
          <p className="text-muted-foreground mt-1">{user.email}</p>
        </div>

        {appointmentsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : appointments.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 flex flex-col items-center justify-center text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
              <CalendarX className="w-7 h-7 text-muted-foreground" />
            </div>
            <div>
              <p className="text-lg font-medium text-foreground">
                У вас нет записей
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Запишитесь на прием к специалисту на главной странице
              </p>
            </div>
            <Button variant="outline" asChild className="border-primary text-primary hover:bg-primary/5">
              <Link href="/#categories">Найти врача</Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-foreground">
              Мои записи ({appointments.length})
            </h2>
            {appointments.map((appointment) => {
              const status = statusLabels[appointment.status] || statusLabels.scheduled
              const dateFormatted = new Date(appointment.date).toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })

              return (
                <div
                  key={appointment.id}
                  className="rounded-xl border border-border bg-card p-5 flex flex-col sm:flex-row sm:items-center gap-4"
                >
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <User2 className="w-4 h-4 text-primary" />
                      <span className="font-medium text-foreground">
                        {appointment.doctorName || "Врач"}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {dateFormatted}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {appointment.time}
                      </span>
                    </div>
                    {appointment.price != null && appointment.price > 0 && (
                      <p className="text-sm text-muted-foreground">
                        {appointment.price.toLocaleString("ru-RU")} ₽
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium ${status.className}`}>
                      {status.label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
