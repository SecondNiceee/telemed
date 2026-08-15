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
  /**
   * "hero"   — большой баннер на /lk и /lk-med
   * "header" — компактный на главной странице (только для users)
   */
  variant?: "hero" | "header"
  /** Путь кнопки "Перейти в чат". По умолчанию /lk/chat */
  chatHref?: string
  /**
   * Палитра hero-варианта:
   * "onLight" — светлая подложка (по умолчанию, /lk-med)
   * "onDark"  — тёмная секция surface-dark (шапка кабинета /lk)
   */
  tone?: "onLight" | "onDark"
  /** Контекст для отображения имени: "patient" покажет имя врача, "doctor" покажет имя пациента */
  context?: "patient" | "doctor"
  className?: string
}

function CountdownDigits({
  parts,
  onDark = false,
}: {
  parts: NonNullable<ReturnType<typeof getCountdownParts>>
  onDark?: boolean
}) {
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
          <span
            className={cn(
              "font-mono text-3xl font-bold tabular-nums leading-none",
              onDark ? "text-white" : "text-foreground",
            )}
          >
            {b.value}
          </span>
          <span
            className={cn(
              "mb-0.5 text-xs font-semibold",
              onDark ? "text-teal-on-dark" : "text-teal",
            )}
          >
            {b.label}
          </span>
        </div>
      ))}
    </div>
  )
}

export function AppointmentCountdownBanner({
  appointment,
  variant = "hero",
  chatHref,
  tone = "onLight",
  context = "patient",
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
  const dateFormatted = appointment.date ? appointment.date.split("-").reverse().slice(0, 2).join(".") : ""
  const resolvedChatHref = chatHref ?? `/lk/chat?appointment=${appointment.id}`

  // ─── Compact header variant ────────────────────────────────────────────────
  if (variant === "header") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-2.5 rounded-xl",
          "border border-teal/25 bg-teal-soft",
          className
        )}
      >
        {/* Pulsing dot */}
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-teal" />
        </span>

        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground whitespace-nowrap">
            Консультация через
          </span>
          <span className="text-sm font-bold text-teal font-mono tabular-nums whitespace-nowrap">
            {countdown}
          </span>
        </div>

        <Button
          asChild
          size="sm"
          className="shrink-0 h-8 bg-teal hover:bg-teal/90 text-teal-foreground gap-1.5 text-xs"
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
  // В контексте врача показываем имя пациента, в контексте пациента - имя врача
  const displayName = context === "doctor" 
    ? (appointment.userName || "Пациент")
    : (appointment.doctorName || null)
  const specialty = (appointment as ApiAppointment & { specialty?: string }).specialty

  const onDark = tone === "onDark"

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl",
        onDark
          ? "bg-white/[0.06] ring-1 ring-inset ring-white/12"
          : "border border-teal/25 bg-teal-soft",
        className
      )}
    >
      {/* Верхняя градиентная черта бренда: бирюзовый → фиолетовый */}
      <div
        aria-hidden="true"
        className="h-1 w-full"
        style={{
          background: onDark
            ? "linear-gradient(to right, var(--teal-on-dark), var(--primary))"
            : "linear-gradient(to right, var(--teal), var(--primary))",
        }}
      />

      <div className="flex flex-col gap-5 px-5 py-5 sm:flex-row sm:items-center">
        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <span className="relative flex h-2 w-2 shrink-0">
              <span
                className={cn(
                  "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                  onDark ? "bg-teal-on-dark" : "bg-teal",
                )}
              />
              <span
                className={cn(
                  "relative inline-flex h-2 w-2 rounded-full",
                  onDark ? "bg-teal-on-dark" : "bg-teal",
                )}
              />
            </span>
            <p
              className={cn(
                "text-[11px] font-semibold uppercase tracking-[0.18em]",
                onDark ? "text-teal-on-dark" : "text-teal",
              )}
            >
              Предстоящая консультация
            </p>
          </div>

          <CountdownDigits parts={parts} onDark={onDark} />

          <p
            className={cn(
              "mt-2 text-sm",
              onDark ? "text-white/55" : "text-muted-foreground",
            )}
          >
            {dateFormatted} в {appointment.time}
            {displayName && (
              <>
                {" · "}
                <span className={cn("font-medium", onDark && "text-white/80")}>
                  {displayName}
                </span>
              </>
            )}
            {specialty && <> · {specialty}</>}
          </p>
        </div>

        {/* CTA */}
        <Button
          asChild
          className={cn(
            "shrink-0 gap-2 rounded-full sm:self-center",
            onDark
              ? "bg-white text-surface-dark hover:bg-white/90"
              : "bg-teal text-teal-foreground hover:bg-teal/90",
          )}
        >
          <Link href={resolvedChatHref}>
            <Video className="h-4 w-4" aria-hidden="true" />
            Перейти в чат
          </Link>
        </Button>
      </div>
    </div>
  )
}
