"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Video, ArrowRight, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getCountdownParts, formatCountdown } from "@/lib/utils/date"
import type { ApiAppointment } from "@/lib/api/types"
import { cn } from "@/lib/utils"

interface AppointmentCountdownBannerProps {
  appointment: ApiAppointment
  /**
   * "hero"   — большой баннер на /lk и /lk-med
   * "header" — компактный на главной странице (только для users)
   */
  variant?: "hero" | "header"
  /** Путь кнопки "Перейти в чат". По умолчанию /lk/chat */
  chatHref?: string
  className?: string
}

function CountdownDigits({ parts }: { parts: NonNullable<ReturnType<typeof getCountdownParts>> }) {
  const pad = (n: number) => String(n).padStart(2, "0")
  const blocks = parts.days > 0
    ? [
        { value: String(parts.days), label: "дн" },
        { value: pad(parts.hours), label: "ч" },
        { value: pad(parts.minutes), label: "мин" },
        { value: pad(parts.seconds), label: "сек" },
      ]
    : [
        { value: pad(parts.hours), label: "ч" },
        { value: pad(parts.minutes), label: "мин" },
        { value: pad(parts.seconds), label: "сек" },
      ]

  return (
    <div className="flex items-end gap-2">
      {blocks.map((b, i) => (
        <div key={i} className="flex items-end gap-0.5">
          <span className="text-3xl font-bold tabular-nums leading-none text-green-900 font-mono">
            {b.value}
          </span>
          <span className="text-xs font-semibold text-green-600 mb-0.5">{b.label}</span>
        </div>
      ))}
    </div>
  )
}

export function AppointmentCountdownBanner({
  appointment,
  variant = "hero",
  chatHref,
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

  if (!parts) return null

  const countdown = formatCountdown(parts)
  const dateFormatted = appointment.date.split("-").reverse().slice(0, 2).join(".")
  const resolvedChatHref = chatHref ?? `/lk/chat?appointment=${appointment.id}`

  // ─── Compact header variant ────────────────────────────────────────────────
  if (variant === "header") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-2.5 rounded-xl",
          "border border-green-200 bg-green-50",
          className
        )}
      >
        {/* Pulsing dot */}
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
        </span>

        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-green-800 whitespace-nowrap">
            Консультация через
          </span>
          <span className="text-sm font-bold text-green-900 font-mono tabular-nums whitespace-nowrap">
            {countdown}
          </span>
        </div>

        <Button
          asChild
          size="sm"
          className="shrink-0 h-8 bg-green-600 hover:bg-green-700 text-white gap-1.5 text-xs"
        >
          <Link href="/lk">
            Перейти
            <ArrowRight className="w-3 h-3" />
          </Link>
        </Button>
      </div>
    )
  }

  // ─── Hero variant ──────────────────────────────────────────────────────────
  const doctorOrPatient = appointment.doctorName || appointment.userName || null
  const specialty = (appointment as ApiAppointment & { specialty?: string }).specialty

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-green-200 bg-green-50",
        className
      )}
    >
      {/* Top accent bar */}
      <div className="h-1 w-full bg-gradient-to-r from-green-400 to-green-500" />

      <div className="px-5 py-5 flex flex-col sm:flex-row sm:items-center gap-5">
        {/* Icon */}
        <div className="w-14 h-14 rounded-2xl bg-white border border-green-200 shadow-sm flex items-center justify-center shrink-0">
          <Video className="w-7 h-7 text-green-600" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <p className="text-xs font-semibold uppercase tracking-widest text-green-600">
              Предстоящая консультация
            </p>
          </div>

          <CountdownDigits parts={parts} />

          <div className="flex items-center gap-1.5 mt-2 text-sm text-green-700">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>
              {dateFormatted} в {appointment.time}
              {doctorOrPatient && (
                <> · <span className="font-medium">{doctorOrPatient}</span></>
              )}
              {specialty && <> · {specialty}</>}
            </span>
          </div>
        </div>

        {/* CTA */}
        <Button
          asChild
          className="shrink-0 gap-2 bg-green-600 hover:bg-green-700 text-white sm:self-center"
        >
          <Link href={resolvedChatHref}>
            <Video className="w-4 h-4" />
            Перейти в чат
          </Link>
        </Button>
      </div>
    </div>
  )
}
