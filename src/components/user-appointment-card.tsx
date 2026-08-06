"use client"

import Link from "next/link"
import { Calendar, Clock, User as UserIcon, ExternalLink, MessageSquare } from "lucide-react"
import type { ApiAppointment, ApiDoctor } from "@/lib/api/types"
import { formatDate, getStatusLabel, getStatusColor } from "@/lib/utils/date"

function getDoctorFromAppointment(appt: ApiAppointment): { id: number; email?: string } | null {
  if (typeof appt.doctor === 'object' && appt.doctor !== null) {
    return appt.doctor as ApiDoctor
  }
  if (typeof appt.doctor === 'number') {
    return { id: appt.doctor }
  }
  return null
}

interface UserAppointmentCardProps {
  appointment: ApiAppointment
}

export function UserAppointmentCard({ appointment }: UserAppointmentCardProps) {
  const doc = getDoctorFromAppointment(appointment)

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Top accent line by status */}
      <div
        className={`h-0.5 w-full ${
          appointment.status === "confirmed"
            ? "bg-green-500"
            : appointment.status === "cancelled"
            ? "bg-destructive"
            : "bg-border"
        }`}
      />

      <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <UserIcon className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm leading-tight">
                {appointment.doctorName || "Врач"}
              </p>
              {appointment.specialty && (
                <p className="text-xs text-muted-foreground">{appointment.specialty}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground pl-10">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {formatDate(appointment.date)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {appointment.time}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2.5">
          <div className="flex items-center gap-2">
            {appointment.price != null && (
              <span className="text-base font-bold text-foreground">
                {appointment.price.toLocaleString("ru-RU")} ₽
              </span>
            )}
            <span
              className={`text-xs font-medium px-2.5 py-1 rounded-full ${getStatusColor(appointment.status)}`}
            >
              {getStatusLabel(appointment.status)}
            </span>
          </div>

          {doc && (
            <div className="flex items-center gap-2">
              {appointment.status !== "cancelled" && (
                <Link
                  href={`/lk/chat?appointment=${appointment.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-background text-foreground hover:bg-muted transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Чат
                </Link>
              )}
              <Link
                href={`/doctor/${doc.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Профиль
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
