"use client"

import { useEffect, useState } from "react"
import { useUserStore } from "@/stores/user-store"
import { useUserAppointmentStore } from "@/stores/user-appointments-store"
import { CalendarX, CheckCircle2, Play } from "lucide-react"
import Link from "next/link"
import type { ApiAppointment } from "@/lib/api/types"
import { Button } from "@/components/ui/button"
import { User } from "@/payload-types"
import { UserHeroBanner } from "@/components/user-hero-banner"
import { UserAppointmentCard } from "@/components/user-appointment-card"
import { FeedbackPrompt } from "@/components/feedback-prompt"
import { ConsultationGuide } from "@/components/consultation-guide"
import { cn } from "@/lib/utils"

interface LkContentProps {
  user: User | null
  appointments: ApiAppointment[]
}

type FilterType = 'all' | 'upcoming' | 'active' | 'completed'

export function LkContent({ user, appointments: serverAppointments }: LkContentProps) {
  const { loading: userLoading, setUser, user: storeUser, fetched: userFetched, logout } = useUserStore()
  const { appointments, setAppointments, loading: apptLoading, fetched: apptFetched } = useUserAppointmentStore()
  const [filter, setFilter] = useState<FilterType>('all')

  // Sync user to store
  useEffect(() => {
    if (!storeUser && user) {
      setUser(user)
    }
  }, [storeUser, user, setUser])

  // Always sync server-loaded appointments to store on initial load
  // This ensures fresh SSR data is used even if store was populated by booking
  useEffect(() => {
    if (serverAppointments.length > 0) {
      setAppointments(serverAppointments)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!userFetched || userLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!user) return null

  const isLoading = apptLoading && !apptFetched
  
  // Filter appointments
  const upcomingAppointments = appointments.filter((a) => a.status === "confirmed")
  const activeAppointments = appointments.filter((a) => a.status === "in_progress")
  const completedAppointments = appointments.filter((a) => a.status === "completed")
  
  const filteredAppointments = filter === 'all' 
    ? appointments 
    : filter === 'upcoming' 
      ? upcomingAppointments 
      : filter === 'active'
        ? activeAppointments
        : completedAppointments

  return (
    <div className="flex-1 bg-white">
      {/* Hero banner */}
      <UserHeroBanner
        user={user}
        upcomingCount={upcomingAppointments.length}
        activeCount={activeAppointments.length}
        completedCount={completedAppointments.length}
        onLogout={logout}
        appointments={appointments}
      />

      {/* Appointments list */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Consultation guide for upcoming/active appointments */}
        {(activeAppointments.length > 0 || upcomingAppointments.length > 0) && (
          <ConsultationGuide 
            appointment={activeAppointments[0] || upcomingAppointments[0]} 
          />
        )}

        {/* Feedback prompt for completed consultations */}
        <FeedbackPrompt appointments={appointments} userId={user.id} />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <h2 className="text-base font-semibold text-foreground">Мои записи</h2>
          
          {/* Filter tabs */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-muted">
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
                <span className="ml-1.5 min-w-5 h-5 px-1.5 inline-flex items-center justify-center text-xs rounded-full bg-primary/10 text-primary">
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
                <span className="ml-1.5 min-w-5 h-5 px-1.5 inline-flex items-center justify-center text-xs rounded-full bg-teal-soft text-teal">
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

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-10 flex flex-col items-center justify-center text-center gap-4">
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
              <p className="text-base font-semibold text-foreground">
                {filter === 'all' && "У вас нет записей"}
                {filter === 'upcoming' && "Нет предстоящих записей"}
                {filter === 'active' && "Нет активных консультаций"}
                {filter === 'completed' && "Нет завершённых записей"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {filter === 'all' && "Запишитесь на приём к специалисту на главной странице"}
                {filter === 'upcoming' && "Запишитесь на приём к специалисту на главной странице"}
                {filter === 'active' && "Активные консультации появятся здесь во время приёма"}
                {filter === 'completed' && "Завершённые консультации будут отображаться здесь"}
              </p>
            </div>
            {(filter === 'all' || filter === 'upcoming') && (
              <Button asChild variant="outline" size="sm">
                <Link href="/appointment">Найти врача</Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredAppointments.map((appt) => (
              <UserAppointmentCard key={appt.id} appointment={appt} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
