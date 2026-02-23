"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUserStore } from "@/stores/user-store"
import { useAppointmentStore } from "@/stores/appointment-store"
import { CalendarX, Calendar, Clock, User as UserIcon } from "lucide-react"
import type { ApiAppointment } from "@/lib/api/types"

function formatDate(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00")
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function getStatusLabel(status: ApiAppointment["status"]) {
  switch (status) {
    case "confirmed":
      return "Подтверждена"
    case "completed":
      return "Завершена"
    case "cancelled":
      return "Отменена"
  }
}

function getStatusColor(status: ApiAppointment["status"]) {
  switch (status) {
    case "confirmed":
      return "bg-green-100 text-green-700"
    case "completed":
      return "bg-muted text-muted-foreground"
    case "cancelled":
      return "bg-destructive/10 text-destructive"
  }
}

export function LkContent() {
  const router = useRouter()
  const { user, loading: userLoading, fetched: userFetched, fetchUser } = useUserStore()
  const {
    appointments,
    loading: apptLoading,
    fetched: apptFetched,
    fetchAppointments,
  } = useAppointmentStore()

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  useEffect(() => {
    if (userFetched && !user) {
      router.replace("/")
    }
  }, [userFetched, user, router])

  useEffect(() => {
    if (user) {
      fetchAppointments()
    }
  }, [user, fetchAppointments])

  if (!userFetched || userLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!user) return null

  const isLoading = apptLoading && !apptFetched

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

        <h2 className="text-lg font-semibold text-foreground mb-4">
          Мои записи
        </h2>

        {isLoading ? (
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
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {appointments.map((appt) => (
              <div
                key={appt.id}
                className="rounded-xl border border-border bg-card p-5 flex flex-col sm:flex-row sm:items-center gap-4"
              >
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-foreground">
                      {appt.doctorName || "Врач"}
                    </span>
                  </div>
                  {appt.specialty && (
                    <p className="text-sm text-muted-foreground">
                      {appt.specialty}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(appt.date)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {appt.time}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {appt.price != null && (
                    <span className="text-lg font-bold text-foreground">
                      {appt.price.toLocaleString("ru-RU")} ₽
                    </span>
                  )}
                  <span
                    className={`text-xs font-medium px-2.5 py-1 rounded-full ${getStatusColor(appt.status)}`}
                  >
                    {getStatusLabel(appt.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
