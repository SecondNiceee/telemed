"use client"

import Link from "next/link"
import { memo, useCallback } from "react"
import { Clock, ChevronRight, User, Edit2, Trash2, CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { resolveImageUrl } from "@/lib/utils/image"
import { DoctorsApi } from "@/lib/api/doctors"
import type { ApiDoctor } from "@/lib/api/types"
import type { Media } from "@/payload-types"

interface OrgDoctorCardProps {
  doctor: ApiDoctor
  onDeleteRequest: (doctor: ApiDoctor) => void
}

export const OrgDoctorCard = memo(function OrgDoctorCard({
  doctor,
  onDeleteRequest,
}: OrgDoctorCardProps) {
  const specialty = DoctorsApi.getSpecialty(doctor)

  const handleDelete = useCallback(() => {
    onDeleteRequest(doctor)
  }, [doctor, onDeleteRequest]);

  return (
    <div className="group rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-md transition-all">
      <div className="flex items-center justify-between pr-5">
        <Link
          href={`/lk-org/doctor/${doctor.id}`}
          className="flex-1 h-full flex items-center gap-4 min-w-0"
        >
          <div className="h-[-webkit-fill-available] w-24 rounded-l-xl overflow-hidden bg-muted shrink-0">
            {doctor.photo ? (
              <img
                src={resolveImageUrl((doctor.photo as Media).url)}
                alt={doctor.name || "Врач"}
                className="w-full  object-cover h-[-webkit-fill-available]"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <User className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 py-4">
            <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors truncate">
              {doctor.name || "Без имени"}
            </h3>
            <p className="text-sm text-muted-foreground truncate">{specialty}</p>
            <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
              {doctor.experience != null && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Стаж {doctor.experience} лет
                </span>
              )}
              {doctor.price != null && (
                <span className="font-semibold text-foreground">
                  {doctor.price.toLocaleString("ru-RU")} ₽
                </span>
              )}
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-2 ml-4">
          <Button asChild size="sm" variant="ghost" className="gap-2">
            <Link href={`/lk-org/doctor-schedule/${doctor.id}`}>
              <CalendarDays className="w-4 h-4" />
              <span className="hidden sm:inline">Расписание</span>
            </Link>
          </Button>
          <Button asChild size="sm" variant="ghost" className="gap-2">
            <Link href={`/lk-org/doctor-edit/${doctor.id}`}>
              <Edit2 className="w-4 h-4" />
              <span className="hidden sm:inline">Изменить</span>
            </Link>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleDelete}
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Удалить</span>
          </Button>
        </div>

        <Link href={`/lk-org/doctor/${doctor.id}`} className="shrink-0 ml-2">
          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </Link>
      </div>
    </div>
  )
})
