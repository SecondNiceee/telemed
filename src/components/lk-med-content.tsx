"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useDoctorStore } from "@/stores/doctor-store"
import { AppointmentsApi } from "@/lib/api/appointments"
import type { ApiAppointment } from "@/lib/api/types"
import type { ApiDoctor } from "@/lib/api/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, CalendarX, Calendar, Clock, User2 } from "lucide-react"

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

interface LkMedContentProps {
  initialDoctor: ApiDoctor | null
}

export function LkMedContent({ initialDoctor }: LkMedContentProps) {
  const router = useRouter()
  const { doctor: storeDoctor, login, loading } = useDoctorStore()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [appointments, setAppointments] = useState<ApiAppointment[]>([])
  const [appointmentsLoading, setAppointmentsLoading] = useState(false)

  const doctor = storeDoctor || initialDoctor

  useEffect(() => {
    if (doctor) {
      setAppointmentsLoading(true)
      AppointmentsApi.fetchDoctorAppointments()
        .then((data) => setAppointments(data))
        .catch(() => setAppointments([]))
        .finally(() => setAppointmentsLoading(false))
    }
  }, [doctor])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    try {
      await login(email, password)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при входе")
    }
  }

  // Not logged in as doctor -- show login form
  if (!doctor) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="w-full max-w-sm mx-auto px-4">
          <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
            <div className="text-center mb-6">
              <h1 className="text-xl font-semibold text-foreground">
                Вход для врачей
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Введите логин и пароль вашего аккаунта врача
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="doctor-login-email">Электронная почта</Label>
                <Input
                  id="doctor-login-email"
                  type="email"
                  placeholder="doctor@clinic.ru"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="doctor-login-password">Пароль</Label>
                <Input
                  id="doctor-login-password"
                  type="password"
                  placeholder="Введите пароль"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" />
                    <span>Вход...</span>
                  </>
                ) : (
                  "Войти"
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // Logged in as doctor -- show personal cabinet
  return (
    <div className="flex-1">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <p className="text-sm text-muted-foreground">Кабинет врача</p>
          <h1 className="text-2xl font-semibold text-foreground mt-1">
            {doctor.name || doctor.email}
          </h1>
          <p className="text-muted-foreground mt-1">{doctor.email}</p>
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
                У вас нет консультаций
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Новые консультации появятся здесь, когда пациенты запишутся к вам
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-foreground">
              Мои консультации ({appointments.length})
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
                        {appointment.userName || "Пациент"}
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
