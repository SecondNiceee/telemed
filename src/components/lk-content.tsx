"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUserStore } from "@/stores/user-store"
import { useAppointmentStore } from "@/stores/appointment-store"
import { CalendarX, Calendar, Clock, User as UserIcon, Mail, ExternalLink, LogOut } from "lucide-react"
import Link from "next/link"
import type { ApiAppointment, ApiDoctor } from "@/lib/api/types"
import { Button } from "@/components/ui/button"
import { User } from "@/payload-types"
import { toast } from "sonner"

function getDoctorFromAppointment(appt: ApiAppointment): { id: number; email?: string } | null {
  if (typeof appt.doctor === 'object' && appt.doctor !== null) {
    return appt.doctor as ApiDoctor
  }
  if (typeof appt.doctor === 'number') {
    return { id: appt.doctor }
  }
  return null
}

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
      return "bg-green-100 text-green-700 border border-green-200"
    case "completed":
      return "bg-muted text-muted-foreground border border-border"
    case "cancelled":
      return "bg-destructive/10 text-destructive border border-destructive/20"
  }
}

function getInitials(name?: string | null, email?: string) {
  if (name) {
    return name
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
  }
  return email?.[0]?.toUpperCase() ?? "U"
}

export function LkContent({user} : {user:User|null}) {
  const { loading: userLoading, setUser, user:storeUser, fetched: userFetched, logout } = useUserStore();
  useEffect( () => {
    if (!storeUser){
      setUser(user);
    }
  }, [] )
  const {
    appointments,
    loading: apptLoading,
    fetched: apptFetched,
    fetchAppointments,
  } = useAppointmentStore()



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
  const confirmed = appointments.filter((a) => a.status === "confirmed").length
  const completed = appointments.filter((a) => a.status === "completed").length

  return (
    <div className="flex-1 bg-background">
      {/* Hero banner */}
      <div className="bg-card border-b border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-xl font-bold text-primary">
                  {getInitials(user.name, user.email)}
                </span>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
                  Личный кабинет
                </p>
                <h1 className="text-xl font-bold text-foreground text-balance">
                  {user.name || "Пользователь"}
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">{user.email}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 shrink-0"
              onClick={() => {
                logout();
                toast.success("Вы успешно вышли из аккаунта");
              }}
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Выйти</span>
            </Button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3 mt-6">
            <div className="rounded-xl bg-background border border-border px-4 py-3">
              <p className="text-2xl font-bold text-foreground">{confirmed}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Предстоящих записей</p>
            </div>
            <div className="rounded-xl bg-background border border-border px-4 py-3">
              <p className="text-2xl font-bold text-foreground">{completed}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Завершённых записей</p>
            </div>
          </div>
        </div>
      </div>

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
            {appointments.map((appt) => {
              const doc = getDoctorFromAppointment(appt)
              return (
                <div
                  key={appt.id}
                  className="rounded-xl border border-border bg-card overflow-hidden"
                >
                  {/* Top accent line by status */}
                  <div
                    className={`h-0.5 w-full ${
                      appt.status === "confirmed"
                        ? "bg-green-500"
                        : appt.status === "cancelled"
                        ? "bg-destructive"
                        : "bg-border"
                    }`}
                  />

                  <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1 flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <UserIcon className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-sm leading-tight">
                            {appt.doctorName || "Врач"}
                          </p>
                          {appt.specialty && (
                            <p className="text-xs text-muted-foreground">{appt.specialty}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground pl-10">
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

                    <div className="flex flex-col items-end gap-2.5">
                      <div className="flex items-center gap-2">
                        {appt.price != null && (
                          <span className="text-base font-bold text-foreground">
                            {appt.price.toLocaleString("ru-RU")} ₽
                          </span>
                        )}
                        <span
                          className={`text-xs font-medium px-2.5 py-1 rounded-full ${getStatusColor(appt.status)}`}
                        >
                          {getStatusLabel(appt.status)}
                        </span>
                      </div>

                      {doc && (
                        <div className="flex items-center gap-2">
                          {(doc as ApiDoctor).email && (
                            <a
                              href={`mailto:${(doc as ApiDoctor).email}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-background text-foreground hover:bg-muted transition-colors"
                            >
                              <Mail className="w-3.5 h-3.5" />
                              Написать
                            </a>
                          )}
                          <Link
                            href={`/doctor/${doc.id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Профиль
                          </Link>
                        </div>
                      )}
                    </div>
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
