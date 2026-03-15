"use client"

import { Button } from "@/components/ui/button"
import { LogOut, MessageSquare } from "lucide-react"
import Link from "next/link"
import type { User } from "@/payload-types"
import { getInitials, getUpcomingAppointment } from "@/lib/utils/date"
import type { ApiAppointment } from "@/lib/api/types"
import { AppointmentCountdownBanner } from "@/components/appointment-countdown-banner"

interface UserHeroBannerProps {
  user: User
  confirmedCount: number
  completedCount: number
  onLogout: () => void
  appointments?: ApiAppointment[]
}

export function UserHeroBanner({ user, confirmedCount, completedCount, onLogout, appointments = [] }: UserHeroBannerProps) {
  const upcomingAppointment = getUpcomingAppointment(appointments)

  return (
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
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              asChild
            >
              <Link href="/lk/chat">
                <MessageSquare className="w-4 h-4" />
                <span className="hidden sm:inline">Сообщения</span>
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={onLogout}
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Выйти</span>
            </Button>
          </div>
        </div>

        {/* Upcoming appointment countdown */}
        {upcomingAppointment && (
          <div className="mt-6">
            <AppointmentCountdownBanner
              appointment={upcomingAppointment}
              variant="hero"
              chatHref={`/lk/chat?appointment=${upcomingAppointment.id}`}
            />
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 mt-6">
          <div className="rounded-xl bg-background border border-border px-4 py-3">
            <p className="text-2xl font-bold text-foreground">{confirmedCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Предстоящих записей</p>
          </div>
          <div className="rounded-xl bg-background border border-border px-4 py-3">
            <p className="text-2xl font-bold text-foreground">{completedCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Завершённых записей</p>
          </div>
        </div>
      </div>
    </div>
  )
}
