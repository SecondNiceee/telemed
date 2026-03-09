"use client"

import { useEffect } from "react"
import { useDoctorStore } from "@/stores/doctor-store"
import { useDoctorAppointmentStore } from "@/stores/doctor-appointments-store"
import { Button } from "@/components/ui/button"
import { CalendarX, Calendar, Clock, User as UserIcon, MessageSquare, LogOut } from "lucide-react"
import Link from "next/link"
import type { ApiDoctor, ApiAppointment } from "@/lib/api/types"
import { formatDate, getStatusLabel, getStatusColor } from "@/lib/utils/date"

interface LkMedContentProps {
  initialDoctor: ApiDoctor
}

export function LkMedContent({ initialDoctor }: LkMedContentProps) {
  const { doctor: storeDoctor, setDoctor, logout } = useDoctorStore()
  const {
    appointments,
    loading: apptLoading,
    fetched: apptFetched,
    fetchAppointments,
  } = useDoctorAppointmentStore()

  const doctor = storeDoctor || initialDoctor

  // Sync doctor from server to store
  useEffect(() => {
    if (!storeDoctor && initialDoctor) {
      setDoctor(initialDoctor)
    }
  }, [storeDoctor, initialDoctor, setDoctor])

  // Fetch appointments when doctor is available
  useEffect(() => {
    if (doctor) {
      fetchAppointments()
    }
  }, [doctor, fetchAppointments])

  const isLoading = apptLoading && !apptFetched

  return (
    <div className="flex-1">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Кабинет врача</p>
            <h1 className="text-2xl font-semibold text-foreground mt-1">
              {doctor.name || doctor.email}
            </h1>
            <p className="text-muted-foreground mt-1">{doctor.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <Link href="/lk-med/chat">
                <MessageSquare className="w-4 h-4" />
                <span>Сообщения</span>
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => logout()}
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Выйти</span>
            </Button>
          </div>
        </div>

        <h2 className="text-lg font-semibold text-foreground mb-4">
          Мои консультации
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
                У вас нет консультаций
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Новые консультации появятся здесь, когда пациенты запишутся к вам
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
                      {appt.userName || "Пациент"}
                    </span>
                  </div>
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

                <div className="flex flex-col items-end gap-2">
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
                  {appt.status === "confirmed" && (
                    <Link
                      href={`/lk-med/chat?appointment=${appt.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-card text-foreground hover:bg-secondary transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Написать
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
