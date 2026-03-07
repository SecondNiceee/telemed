"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useDoctorStore } from "@/stores/doctor-store"
import { useAppointmentStore } from "@/stores/appointment-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, CalendarX, Calendar, Clock, User as UserIcon, Mail, MessageSquare, LogOut } from "lucide-react"
import Link from "next/link"
import type { ApiDoctor, ApiAppointment } from "@/lib/api/types"
import { resolveImageUrl } from "@/lib/utils/image"

function getUserEmailFromAppointment(appt: ApiAppointment): string | null {
  if (typeof appt.user === 'object' && appt.user !== null && 'email' in appt.user) {
    return appt.user.email
  }
  return null
}

interface LkMedContentProps {
  initialDoctor: ApiDoctor | null
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
      return "bg-green-100 text-green-700"
    case "completed":
      return "bg-muted text-muted-foreground"
    case "cancelled":
      return "bg-destructive/10 text-destructive"
  }
}

export function LkMedContent({ initialDoctor }: LkMedContentProps) {
  const router = useRouter()
  const { doctor: storeDoctor, login, loading, logout } = useDoctorStore()
  const {
    appointments,
    loading: apptLoading,
    fetched: apptFetched,
    fetchAppointments,
  } = useAppointmentStore()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  const doctor = storeDoctor || initialDoctor

  useEffect(() => {
    if (doctor) {
      fetchAppointments()
    }
  }, [doctor, fetchAppointments])

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
            <div className="flex flex-col items-center gap-3 mb-6">
              <img
                src={resolveImageUrl("/images/logo.jpg")}
                alt="SmartCardio"
                width={48}
                height={48}
                className="w-12 h-12 rounded-lg object-contain"
              />
              <div className="text-center">
                <h1 className="text-xl font-semibold text-foreground">
                  Вход для врачей
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Введите логин и пароль вашего аккаунта врача
                </p>
              </div>
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

  const isLoading = apptLoading && !apptFetched

  // Logged in as doctor -- show personal cabinet
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
                  {(() => {
                    const userEmail = getUserEmailFromAppointment(appt)
                    if (!userEmail) return null
                    return (
                      <a
                        href={`mailto:${userEmail}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-card text-foreground hover:bg-secondary transition-colors"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        Написать
                      </a>
                    )
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
