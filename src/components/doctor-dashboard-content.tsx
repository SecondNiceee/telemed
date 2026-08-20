"use client"

import React, { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Video,
  Clock,
  X,
  Calendar1Icon,
  User as UserIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useDoctorAppointmentStore } from "@/stores/doctor-appointments-store"
import type { ApiAppointment } from "@/lib/api/types"

type ConsultationTab = "all" | "upcoming" | "completed" | "cancelled"
const DOCTOR_FILTER_KEY = "doctor-appointments-filter"
const CONSULTATION_TABS: { id: ConsultationTab; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "upcoming", label: "Предстоящие" },
  { id: "completed", label: "Завершённые" },
  { id: "cancelled", label: "Отменённые" },
]
type FilterMode = "all" | "day" | "range"

interface DateSelection {
  mode: FilterMode
  day: Date | null
  rangeStart: Date | null
  rangeEnd: Date | null
}

const MONTHS_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
]

const WEEKDAYS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function isInRange(date: Date, start: Date | null, end: Date | null) {
  if (!start || !end) return false
  const d = date.getTime()
  const s = Math.min(start.getTime(), end.getTime())
  const e = Math.max(start.getTime(), end.getTime())
  return d >= s && d <= e
}

function Calendar({
  selection,
  onSelect,
}: {
  selection: DateSelection
  onSelect: (selection: DateSelection) => void
}) {
  const today = new Date()
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [viewYear, setViewYear] = useState(today.getFullYear())

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1)
  let startWeekday = firstDayOfMonth.getDay() - 1
  if (startWeekday < 0) startWeekday = 6

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear(viewYear - 1)
    } else {
      setViewMonth(viewMonth - 1)
    }
  }

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear(viewYear + 1)
    } else {
      setViewMonth(viewMonth + 1)
    }
  }

  const handleDayClick = (day: number) => {
    const clickedDate = new Date(viewYear, viewMonth, day)

    if (selection.mode === "day") {
      if (selection.day && isSameDay(selection.day, clickedDate)) {
        onSelect({ ...selection, mode: "all", day: null })
      } else {
        onSelect({ ...selection, day: clickedDate })
      }
    } else if (selection.mode === "range") {
      if (!selection.rangeStart || (selection.rangeStart && selection.rangeEnd)) {
        onSelect({ ...selection, rangeStart: clickedDate, rangeEnd: null })
      } else {
        onSelect({ ...selection, rangeEnd: clickedDate })
      }
    }
  }

  const cells: React.ReactNode[] = []
  for (let i = 0; i < startWeekday; i++) {
    cells.push(<div key={`empty-${i}`} />)
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(viewYear, viewMonth, day)
    const isToday = isSameDay(date, today)
    const isSelected =
      selection.mode === "day" && selection.day && isSameDay(date, selection.day)
    const isRangeStart =
      selection.mode === "range" &&
      selection.rangeStart &&
      isSameDay(date, selection.rangeStart)
    const isRangeEnd =
      selection.mode === "range" &&
      selection.rangeEnd &&
      isSameDay(date, selection.rangeEnd)
    const inRange =
      selection.mode === "range" &&
      isInRange(date, selection.rangeStart, selection.rangeEnd)

    cells.push(
      <button
        key={day}
        type="button"
        onClick={() => handleDayClick(day)}
        disabled={selection.mode === "all"}
        className={cn(
          "relative h-9 w-9 rounded-lg text-sm font-medium transition-all",
          "hover:bg-primary/10 disabled:opacity-40 disabled:cursor-default disabled:hover:bg-transparent",
          isToday && !isSelected && !isRangeStart && !isRangeEnd && !inRange &&
            "ring-1 ring-primary/40 text-primary font-semibold",
          isSelected && "bg-primary text-primary-foreground hover:bg-primary/90",
          (isRangeStart || isRangeEnd) &&
            "bg-primary text-primary-foreground hover:bg-primary/90",
          inRange && !isRangeStart && !isRangeEnd && "bg-primary/15 text-primary",
        )}
      >
        {day}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-foreground">
          {MONTHS_RU[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center">
        {WEEKDAYS_RU.map((wd) => (
          <div
            key={wd}
            className="h-9 flex items-center justify-center text-xs font-medium text-muted-foreground"
          >
            {wd}
          </div>
        ))}
        {cells}
      </div>
    </div>
  )
}

function FilterLabel({ selection }: { selection: DateSelection }) {
  if (selection.mode === "all") {
    return <span>За все время</span>
  }
  if (selection.mode === "day" && selection.day) {
    return (
      <span>
        {selection.day.toLocaleDateString("ru-RU", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </span>
    )
  }
  if (selection.mode === "range") {
    if (selection.rangeStart && selection.rangeEnd) {
      const fmt = (d: Date) =>
        d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
      const start =
        selection.rangeStart.getTime() <= selection.rangeEnd.getTime()
          ? selection.rangeStart
          : selection.rangeEnd
      const end =
        selection.rangeStart.getTime() <= selection.rangeEnd.getTime()
          ? selection.rangeEnd
          : selection.rangeStart
      return (
        <span>
          {fmt(start)} &mdash; {fmt(end)}
        </span>
      )
    }
    if (selection.rangeStart) {
      return (
        <span>
          С{" "}
          {selection.rangeStart.toLocaleDateString("ru-RU", {
            day: "numeric",
            month: "short",
          })}{" "}
          &mdash; ...
        </span>
      )
    }
    return <span>Выберите даты</span>
  }
  return null
}

function formatAppointmentDate(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00")
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function getStatusLabel(status: ApiAppointment["status"]) {
  switch (status) {
    case "pending_payment":
      return "Ожидает оплаты"
    case "confirmed":
      return "Подтверждена"
    case "in_progress":
      return "В процессе"
    case "completed":
      return "Завершена"
    case "cancelled":
      return "Отменена"
  }
}

function getStatusColor(status: ApiAppointment["status"]) {
  switch (status) {
    case "pending_payment":
      return "bg-amber-500/10 text-amber-600"
    case "confirmed":
      return "bg-teal-soft text-teal"
    case "in_progress":
      return "bg-primary/10 text-primary"
    case "completed":
      return "bg-muted text-muted-foreground"
    case "cancelled":
      return "bg-destructive/10 text-destructive"
  }
}

export function DoctorDashboardContent({
  userName,
  doctorId,
}: {
  userName: string
  /** Нужен для фильтра выборки: иначе в дашборд попадают записи чужих врачей. */
  doctorId: number
}) {
  const {
    appointments,
    loading: apptLoading,
    fetched: apptFetched,
    fetchAppointments,
  } = useDoctorAppointmentStore()

  useEffect(() => {
    fetchAppointments(doctorId)
  }, [fetchAppointments, doctorId])

  const [tab, setTab] = useState<ConsultationTab>("all")
  useEffect(() => {
    const saved = window.localStorage.getItem(DOCTOR_FILTER_KEY)
    if (CONSULTATION_TABS.some(({ id }) => id === saved)) setTab(saved as ConsultationTab)
  }, [])
  const changeTab = (nextTab: ConsultationTab) => {
    setTab(nextTab)
    window.localStorage.setItem(DOCTOR_FILTER_KEY, nextTab)
  }
  const [selection, setSelection] = useState<DateSelection>({
    mode: "all",
    day: null,
    rangeStart: null,
    rangeEnd: null,
  })

  const handleModeChange = (mode: FilterMode) => {
    setSelection({
      mode,
      day: null,
      rangeStart: null,
      rangeEnd: null,
    })
  }

  const clearFilter = () => {
    setSelection({ mode: "all", day: null, rangeStart: null, rangeEnd: null })
  }

  const consultationCounts: Record<ConsultationTab, number> = {
    all: appointments.length,
    upcoming: appointments.filter((appointment) =>
      ["confirmed", "in_progress"].includes(appointment.status),
    ).length,
    completed: appointments.filter((appointment) => appointment.status === "completed").length,
    cancelled: appointments.filter((appointment) => appointment.status === "cancelled").length,
  }

  // Filter appointments by tab and date selection
  const filteredAppointments = appointments.filter((appt) => {
    // Tab filter
    if (tab === "upcoming" && !["confirmed", "in_progress"].includes(appt.status)) return false
    if (tab === "completed" && appt.status !== "completed") return false
    if (tab === "cancelled" && appt.status !== "cancelled") return false

    // Date filter
    if (selection.mode === "day" && selection.day) {
      const apptDate = new Date(appt.date + "T00:00:00")
      if (!isSameDay(apptDate, selection.day)) return false
    }
    if (selection.mode === "range" && selection.rangeStart && selection.rangeEnd) {
      const apptDate = new Date(appt.date + "T00:00:00")
      if (!isInRange(apptDate, selection.rangeStart, selection.rangeEnd)) return false
    }

    return true
  })

  return (
    <div className="flex-1">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground text-balance">
            Личный кабинет врача
          </h1>
          <p className="text-muted-foreground mt-1">
            Добро пожаловать, {userName}
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Status filter: picker below 1024px, tabs on desktop */}
            <div className="mb-6 lg:hidden">
              <Select value={tab} onValueChange={(value) => changeTab(value as ConsultationTab)}>
                <SelectTrigger className="h-11 w-full rounded-xl bg-card px-4 shadow-sm" aria-label="Фильтр консультаций">
                  <SelectValue placeholder="Выберите раздел" />
                </SelectTrigger>
                <SelectContent position="popper" className="min-w-[var(--radix-select-trigger-width)] rounded-xl">
                  <SelectGroup>
                    {CONSULTATION_TABS.map((item) => (
                      <SelectItem key={item.id} value={item.id} className="py-2.5">
                        {item.label} ({consultationCounts[item.id]})
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div role="tablist" aria-label="Фильтр консультаций" className="mb-6 hidden rounded-xl bg-muted p-1 lg:flex">
              {CONSULTATION_TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.id}
                  onClick={() => changeTab(item.id)}
                  className={cn(
                    "flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    tab === item.id
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label} ({consultationCounts[item.id]})
                </button>
              ))}
            </div>

            {/* Active filter chip */}
            {selection.mode !== "all" && (
              <div className="flex items-center gap-2 mb-4">
                <div className="inline-flex items-center gap-2 rounded-lg bg-primary/10 text-primary px-3 py-1.5 text-sm font-medium">
                  <CalendarDays className="w-3.5 h-3.5" />
                  <FilterLabel selection={selection} />
                  <button
                    type="button"
                    onClick={clearFilter}
                    className="ml-1 p-0.5 rounded hover:bg-primary/20 transition-colors"
                    aria-label="Clear filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            {/* Appointments List */}
            {apptLoading && !apptFetched ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            ) : filteredAppointments.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-12 flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-5">
                  <Video className="w-7 h-7 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Нет консультаций в выбранном разделе
                </h3>
                <p className="text-muted-foreground text-sm max-w-sm leading-relaxed">
                  Измените фильтр статуса или выбранный период.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredAppointments.map((appt) => (
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
                          <Calendar1Icon className="w-3.5 h-3.5" />
                          {formatAppointmentDate(appt.date)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {appt.time}
                        </span>
                      </div>
                    </div>

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
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar - Calendar & Filter */}
          <div className="lg:w-[300px] shrink-0">
            <div className="rounded-xl border border-border bg-card p-5 lg:sticky lg:top-24">
              <div className="flex items-center gap-2 mb-5">
                <CalendarDays className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">
                  Фильтр по дате
                </span>
              </div>

              {/* Filter mode selector */}
              <div className="flex flex-col gap-1.5 mb-5">
                <button
                  type="button"
                  onClick={() => handleModeChange("all")}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all text-left",
                    selection.mode === "all"
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full shrink-0",
                      selection.mode === "all"
                        ? "bg-primary"
                        : "bg-muted-foreground/30"
                    )}
                  />
                  За все время
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange("day")}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all text-left",
                    selection.mode === "day"
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full shrink-0",
                      selection.mode === "day"
                        ? "bg-primary"
                        : "bg-muted-foreground/30"
                    )}
                  />
                  Конкретный день
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange("range")}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all text-left",
                    selection.mode === "range"
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full shrink-0",
                      selection.mode === "range"
                        ? "bg-primary"
                        : "bg-muted-foreground/30"
                    )}
                  />
                  С даты по дату
                </button>
              </div>

              {/* Calendar */}
              <div
                className={cn(
                  "transition-opacity",
                  selection.mode === "all"
                    ? "opacity-40 pointer-events-none"
                    : "opacity-100"
                )}
              >
                <Calendar selection={selection} onSelect={setSelection} />
              </div>

              {/* Quick info */}
              {selection.mode !== "all" && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    {selection.mode === "day"
                      ? "Нажмите на день для выбора. Нажмите повторно для отмены."
                      : "Нажмите на начальную дату, затем на конечную."}
                  </p>
                </div>
              )}

              {selection.mode !== "all" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilter}
                  className="w-full mt-3 text-muted-foreground"
                >
                  Сбросить фильтр
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
