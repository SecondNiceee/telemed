"use client"

import { useEffect, useState, useCallback } from "react"
import { useDoctorStore } from "@/stores/doctor-store"
import { useDoctorAppointmentStore } from "@/stores/doctor-appointments-store"
import { Button } from "@/components/ui/button"
import { CalendarX, Calendar, Clock, User as UserIcon, MessageSquare, LogOut, CheckCircle2, Play, RefreshCw, ChevronLeft, ChevronRight, Mic, Video } from "lucide-react"
import Link from "next/link"
import type { ApiDoctor, ApiAppointment } from "@/lib/api/types"
import { formatDate, getStatusLabel, getStatusColor, getUpcomingAppointment } from "@/lib/utils/date"
import { AppointmentCountdownBanner } from "@/components/appointment-countdown-banner"
import { cn } from "@/lib/utils"
import { AppointmentsApi } from "@/lib/api/appointments"

interface LkMedContentProps {
  initialDoctor: ApiDoctor
  initialAppointments: ApiAppointment[]
}

export function LkMedContent({ initialDoctor, initialAppointments }: LkMedContentProps) {
  const { doctor: storeDoctor, setDoctor, logout } = useDoctorStore()
  const {
    appointments: storeAppointments,
    fetched: apptFetched,
    setAppointments,
  } = useDoctorAppointmentStore()

  const doctor = storeDoctor || initialDoctor
  const appointments = apptFetched ? storeAppointments : initialAppointments
  const upcomingAppointment = getUpcomingAppointment(appointments)

  const [filter, setFilter] = useState<'all' | 'upcoming' | 'active' | 'completed'>('all')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 10

  const upcomingAppointments = appointments.filter(a => a.status === 'confirmed')
  const activeAppointments = appointments.filter(a => a.status === 'in_progress')
  const completedAppointments = appointments.filter(a => a.status === 'completed')
  const filteredAppointments = filter === 'all'
    ? appointments
    : filter === 'upcoming'
      ? upcomingAppointments
      : filter === 'active'
        ? activeAppointments
        : completedAppointments

  const totalPages = Math.max(1, Math.ceil(filteredAppointments.length / PAGE_SIZE))
  const paginatedAppointments = filteredAppointments.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  )

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const fresh = await AppointmentsApi.fetchDoctorAppointments()
      setAppointments(fresh)
      setCurrentPage(1)
    } finally {
      setIsRefreshing(false)
    }
  }, [setAppointments])

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [filter])

  // Sync doctor from server to store
  useEffect(() => {
    if (!storeDoctor && initialDoctor) {
      setDoctor(initialDoctor)
    }
  }, [storeDoctor, initialDoctor, setDoctor])

  // Sync appointments from server to store
  useEffect(() => {
    if (!apptFetched && initialAppointments.length > 0) {
      setAppointments(initialAppointments)
    } else if (!apptFetched) {
      setAppointments([])
    }
  }, [apptFetched, initialAppointments, setAppointments])

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

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="rounded-xl bg-card border border-border px-4 py-3">
            <p className="text-2xl font-bold text-foreground">{upcomingAppointments.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Предстоящих</p>
          </div>
          <div className="rounded-xl bg-card border border-border px-4 py-3">
            <p className="text-2xl font-bold text-foreground">{activeAppointments.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Активных</p>
          </div>
          <div className="rounded-xl bg-card border border-border px-4 py-3">
            <p className="text-2xl font-bold text-foreground">{completedAppointments.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Завершённых</p>
          </div>
        </div>

        {/* Upcoming appointment countdown */}
        {upcomingAppointment && (
          <AppointmentCountdownBanner
            appointment={upcomingAppointment}
            variant="hero"
            context="doctor"
            chatHref={`/lk-med/chat?appointment=${upcomingAppointment.id}`}
            className="mb-8"
          />
        )}

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            Мои консультации
          </h2>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Нажмите, чтобы загрузить новые консультации"
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
              "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95",
              "ring-2 ring-primary/30 ring-offset-1",
              isRefreshing && "opacity-70 cursor-not-allowed"
            )}
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
            {isRefreshing ? "Обновление..." : "Обновить"}
          </button>
        </div>
          
        {/* Filter tabs */}
        <div className="mb-4">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-muted w-fit">
            <button
              onClick={() => setFilter('all')}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                filter === 'all' 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Все
              {appointments.length > 0 && (
                <span className="ml-1.5 min-w-5 h-5 px-1.5 inline-flex items-center justify-center text-xs rounded-full bg-muted-foreground/20 text-muted-foreground">
                  {appointments.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setFilter('upcoming')}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                filter === 'upcoming' 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Предстоящие
              {upcomingAppointments.length > 0 && (
                <span className="ml-1.5 min-w-5 h-5 px-1.5 inline-flex items-center justify-center text-xs rounded-full bg-blue-100 text-blue-700">
                  {upcomingAppointments.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setFilter('active')}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                filter === 'active' 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Активные
              {activeAppointments.length > 0 && (
                <span className="ml-1.5 min-w-5 h-5 px-1.5 inline-flex items-center justify-center text-xs rounded-full bg-green-100 text-green-700">
                  {activeAppointments.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                filter === 'completed' 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Завершённые
              {completedAppointments.length > 0 && (
                <span className="ml-1.5 min-w-5 h-5 px-1.5 inline-flex items-center justify-center text-xs rounded-full bg-muted-foreground/20 text-muted-foreground">
                  {completedAppointments.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {filteredAppointments.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 flex flex-col items-center justify-center text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
              {filter === 'completed' ? (
                <CheckCircle2 className="w-7 h-7 text-muted-foreground" />
              ) : filter === 'active' ? (
                <Play className="w-7 h-7 text-muted-foreground" />
              ) : (
                <CalendarX className="w-7 h-7 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="text-lg font-medium text-foreground">
                {filter === 'all' && "Нет консультаций"}
                {filter === 'upcoming' && "Нет предстоящих консультаций"}
                {filter === 'active' && "Нет активных консультаций"}
                {filter === 'completed' && "Нет завершённых консультаций"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {filter === 'all' && "Консультации появятся здесь, когда пациенты запишутся к вам"}
                {filter === 'upcoming' && "Предстоящие консультации появятся здесь, когда пациенты запишутся к вам"}
                {filter === 'active' && "Активные консультации появятся здесь во время приёма"}
                {filter === 'completed' && "Завершённые консультации будут отображаться здесь"}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {paginatedAppointments.map((appt) => (
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
                    {appt.connectionType && (
                      <span className={cn(
                        "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                        appt.connectionType === 'video' && "bg-blue-100 text-blue-700",
                        appt.connectionType === 'audio' && "bg-purple-100 text-purple-700",
                        appt.connectionType === 'chat' && "bg-green-100 text-green-700"
                      )}>
                        {appt.connectionType === 'video' && <Video className="w-3 h-3" />}
                        {appt.connectionType === 'audio' && <Mic className="w-3 h-3" />}
                        {appt.connectionType === 'chat' && <MessageSquare className="w-3 h-3" />}
                        {appt.connectionType === 'video' && 'Видео'}
                        {appt.connectionType === 'audio' && 'Аудио'}
                        {appt.connectionType === 'chat' && 'Чат'}
                      </span>
                    )}
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
                  <Link
                    href={`/lk-med/chat?appointment=${appt.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-card text-foreground hover:bg-secondary transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Чат
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Страница {currentPage} из {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={cn(
                  "inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-border transition-colors",
                  currentPage === 1
                    ? "opacity-40 cursor-not-allowed bg-card text-muted-foreground"
                    : "bg-card text-foreground hover:bg-secondary"
                )}
              >
                <ChevronLeft className="w-4 h-4" />
                Назад
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className={cn(
                  "inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-border transition-colors",
                  currentPage === totalPages
                    ? "opacity-40 cursor-not-allowed bg-card text-muted-foreground"
                    : "bg-card text-foreground hover:bg-secondary"
                )}
              >
                Вперёд
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
