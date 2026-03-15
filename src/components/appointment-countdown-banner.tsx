"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Video, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getCountdownParts, formatCountdown } from "@/lib/utils/date"
import type { ApiAppointment } from "@/lib/api/types"
import { cn } from "@/lib/utils"

interface AppointmentCountdownBannerProps {
  appointment: ApiAppointment
  /** "hero" — большой баннер на /lk, "header" — компактный на главной */
  variant?: "hero" | "header"
  className?: string
}

export function AppointmentCountdownBanner({
  appointment,
  variant = "hero",
  className,
}: AppointmentCountdownBannerProps) {
  const [parts, setParts] = useState(() =>
    getCountdownParts(appointment.date, appointment.time)
  )

  useEffect(() => {
    const timer = setInterval(() => {
      setParts(getCountdownParts(appointment.date, appointment.time))
    }, 1000)
    return () => clearInterval(timer)
  }, [appointment.date, appointment.time])

  // Once the appointment time has passed — don't show anything
  if (!parts) return null

  const countdown = formatCountdown(parts)

  if (variant === "header") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-xl border border-green-200 bg-green-50 text-green-800",
          className
        )}
      >
        <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
          <Video className="w-4 h-4 text-green-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-green-600 leading-none mb-0.5">
            У вас консультация через
          </p>
          <p className="text-sm font-bold text-green-900 font-mono tabular-nums">
            {countdown}
          </p>
        </div>
        <Button
          asChild
          size="sm"
          className="shrink-0 bg-green-600 hover:bg-green-700 text-white gap-1.5"
        >
          <Link href="/lk">
            Перейти
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </Button>
      </div>
    )
  }

  // variant === "hero"
  return (
    <div
      className={cn(
        "rounded-2xl border border-green-200 bg-green-50 overflow-hidden",
        className
      )}
    >
      <div className="h-1 w-full bg-green-400" />
      <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
            <Video className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-green-600 mb-0.5">
              Консультация через
            </p>
            <p className="text-2xl font-bold text-green-900 font-mono tabular-nums leading-none">
              {countdown}
            </p>
            <p className="text-xs text-green-700 mt-1">
              {appointment.doctorName || "Врач"}
              {appointment.specialty ? ` · ${appointment.specialty}` : ""}
              {" · "}{appointment.date.split("-").reverse().slice(0, 2).join(".")}{" в "}{appointment.time}
            </p>
          </div>
        </div>
        <Button
          asChild
          className="shrink-0 bg-green-600 hover:bg-green-700 text-white gap-2 sm:self-center"
        >
          <Link href={`/lk/chat?appointment=${appointment.id}`}>
            <Video className="w-4 h-4" />
            Перейти в чат
          </Link>
        </Button>
      </div>
    </div>
  )
}
