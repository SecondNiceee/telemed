"use client"

import React from "react"
import Link from "next/link"
import { resolveImageUrl } from "@/lib/utils/image"
import { DoctorsApi } from "@/lib/api/doctors"
import type { ApiDoctor } from "@/lib/api/types"
import {
  Clock,
  ChevronRight,
  Users,
  User,
  UserPlus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Media } from "@/payload-types"

interface LkOrgContentProps {
  userName: string
  initialDoctors: ApiDoctor[]
  orgId: number
}

export function LkOrgContent({ userName, initialDoctors }: LkOrgContentProps) {
  return (
    <div className="flex-1">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground text-balance">
              Кабинет организации
            </h1>
            <p className="text-muted-foreground mt-1">
              Добро пожаловать, {userName}
            </p>
          </div>
          <Button asChild className="gap-2">
            <Link href="/lk-org/doctor-create">
              <UserPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Создать врача</span>
            </Link>
          </Button>
        </div>

        {/* Doctors list */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Врачи
              </h2>
              <p className="text-sm text-muted-foreground">
                {initialDoctors.length === 0
                  ? "Пока нет добавленных врачей"
                  : `${initialDoctors.length} ${initialDoctors.length === 1 ? "врач" : initialDoctors.length < 5 ? "врача" : "врачей"}`}
              </p>
            </div>
          </div>

          {initialDoctors.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-10 flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                <User className="w-8 h-8 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-foreground font-medium">
                  Нет врачей
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Добавьте первого врача, чтобы начать работу
                </p>
              </div>
              <Button asChild className="gap-2">
                <Link href="/lk-org/doctor-create">
                  <UserPlus className="w-4 h-4" />
                  Создать врача
                </Link>
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {initialDoctors.map((doctor) => {
                const specialty = DoctorsApi.getSpecialty(doctor)

                return (
                  <Link
                    key={doctor.id}
                    href={`/doctor/${doctor.id}`}
                    className="group rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center gap-4 p-4">
                      <div className="w-14 h-14 rounded-xl overflow-hidden bg-muted shrink-0">
                        {doctor.photo ? (
                          <img
                            src={resolveImageUrl((doctor.photo as Media).url)}
                            alt={doctor.name || "Врач"}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <User className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                          {doctor.name || "Без имени"}
                        </h3>
                        <p className="text-sm text-muted-foreground truncate">
                          {specialty}
                        </p>
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

                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
