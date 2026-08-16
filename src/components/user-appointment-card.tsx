"use client"

import Link from "next/link"
import type { ApiAppointment, ApiDoctor } from "@/lib/api/types"
import { formatDate, getStatusLabel, getStatusColor, getInitials } from "@/lib/utils/date"
import { cn } from "@/lib/utils"

function getDoctorFromAppointment(appt: ApiAppointment): { id: number; email?: string } | null {
  if (typeof appt.doctor === 'object' && appt.doctor !== null) {
    return appt.doctor as ApiDoctor
  }
  if (typeof appt.doctor === 'number') {
    return { id: appt.doctor }
  }
  return null
}

/** Цвет вертикальной полосы-акцента слева по статусу записи */
const STATUS_RAIL: Record<string, string> = {
  confirmed: "var(--primary)",
  in_progress: "var(--teal)",
  pending_payment: "oklch(0.769 0.16 70)",
  cancelled: "var(--destructive)",
  completed: "var(--border)",
}

interface UserAppointmentCardProps {
  appointment: ApiAppointment
}

export function UserAppointmentCard({ appointment }: UserAppointmentCardProps) {
  const doc = getDoctorFromAppointment(appointment)

  // Бронь истекла, но status ещё 'pending_payment': sweep отменяет её не мгновенно
  // (фоновый проход — раз в минуту, адресный — не чаще раза в 10 секунд).
  // Без этой проверки кабинет показывал активную кнопку «Оплатить» для брони,
  // слот которой уже вернулся к врачу, — клик вёл на /appointment/[id]/payment,
  // и та страница просто редиректила назад.
  const isExpiredHold =
    appointment.status === "pending_payment" &&
    !!appointment.paymentExpiresAt &&
    new Date(appointment.paymentExpiresAt).getTime() <= Date.now()

  // Истёкшую бронь показываем как отменённую: sweep её всё равно отменит,
  // а «Ожидает оплаты» здесь ввело бы пациента в заблуждение.
  const displayStatus = isExpiredHold ? "cancelled" : appointment.status

  // Неоплаченная бронь: чата ещё нет, единственное действие — оплатить.
  const isPendingPayment = appointment.status === "pending_payment" && !isExpiredHold
  const rail = STATUS_RAIL[displayStatus] ?? "var(--border)"

  return (
    <article className="group relative overflow-hidden rounded-2xl bg-card shadow-[0_0_0_1px_oklch(0_0_0_/_0.07),0_10px_28px_-18px_oklch(0.2079_0.0399_265.8_/_0.20)] transition-shadow duration-300 hover:shadow-[0_0_0_1px_oklch(0.6273_0.1067_201.3_/_0.30),0_16px_36px_-18px_oklch(0.2079_0.0399_265.8_/_0.26)]">
      {/* Полоса-акцент статуса */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: rail }}
      />

      <div className="flex flex-col gap-4 pl-6 pr-5 py-5 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          {/* Инициалы врача вместо родовой иконки пользователя */}
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/8 font-semibold text-primary ring-1 ring-inset ring-primary/15">
            {getInitials(appointment.doctorName ?? undefined)}
          </span>

          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold leading-tight text-foreground">
              {appointment.doctorName || "Врач"}
            </p>
            {appointment.specialty && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {appointment.specialty}
              </p>
            )}
            <p className="mt-1.5 font-mono text-xs tabular-nums text-muted-foreground">
              {formatDate(appointment.date)}
              <span className="mx-1.5 text-border">|</span>
              <span className="font-semibold text-foreground">{appointment.time}</span>
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2.5 sm:items-end">
          <div className="flex items-center gap-2.5">
            {appointment.price != null && (
              <span className="font-mono text-[15px] font-bold tabular-nums text-foreground">
                {appointment.price.toLocaleString("ru-RU")} ₽
              </span>
            )}
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                getStatusColor(displayStatus),
              )}
            >
              {isExpiredHold ? "Бронь истекла" : getStatusLabel(displayStatus)}
            </span>
          </div>

          {isPendingPayment ? (
            <Link
              href={`/appointment/${appointment.id}/payment`}
              className="inline-flex items-center rounded-full bg-amber-500 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-600"
            >
              Оплатить
            </Link>
          ) : (
            doc && (
              <div className="flex items-center gap-2">
                {displayStatus !== "cancelled" && (
                  <Link
                    href={`/lk/chat?appointment=${appointment.id}`}
                    className="inline-flex items-center rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Чат
                  </Link>
                )}
                <Link
                  href={`/doctor/${doc.id}`}
                  className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground underline decoration-border decoration-1 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary/40"
                >
                  Профиль
                </Link>
              </div>
            )
          )}
        </div>
      </div>
    </article>
  )
}
