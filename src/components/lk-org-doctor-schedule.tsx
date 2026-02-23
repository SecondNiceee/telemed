"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DoctorsApi } from "@/lib/api/doctors"
import type { DoctorScheduleDate, DoctorScheduleSlot } from "@/lib/api/types"
import {
  ArrowLeft,
  Loader2,
  Plus,
  X,
  Clock,
  CalendarDays,
  Save,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Trash2,
} from "lucide-react"
import Link from "next/link"

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
]
const WEEKDAY_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]

const SLOT_DURATION_OPTIONS = [
  { value: "15", label: "15 мин" },
  { value: "30", label: "30 мин" },
  { value: "45", label: "45 мин" },
  { value: "60", label: "1 час" },
  { value: "90", label: "1.5 часа" },
]

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function formatDateShort(s: string): string {
  const d = parseDate(s)
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3).toLowerCase()}`
}

function formatDateFull(s: string): string {
  const d = parseDate(s)
  const dayNames = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"]
  return `${dayNames[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()].toLowerCase()} ${d.getFullYear()}`
}

function getMonthDays(year: number, month: number): Date[] {
  const days: Date[] = []
  const d = new Date(year, month, 1)
  while (d.getMonth() === month) {
    days.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return days
}

/** Monday=0 ... Sunday=6 */
function getMondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7
}

function sortSlots(slots: DoctorScheduleSlot[]): DoctorScheduleSlot[] {
  return [...slots].sort((a, b) => a.time.localeCompare(b.time))
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

interface LkOrgDoctorScheduleProps {
  doctorId: number
  orgId: number
}

export function LkOrgDoctorSchedule({ doctorId }: LkOrgDoctorScheduleProps) {
  const [schedule, setSchedule] = useState<DoctorScheduleDate[]>([])
  const [slotDuration, setSlotDuration] = useState("30")
  const [doctorName, setDoctorName] = useState("")
  const [fetchLoading, setFetchLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  // Calendar state
  const today = useMemo(() => {
    const n = new Date()
    return new Date(n.getFullYear(), n.getMonth(), n.getDate())
  }, [])
  const maxDate = useMemo(() => {
    const d = new Date(today)
    d.setFullYear(d.getFullYear() + 1)
    return d
  }, [today])

  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // Clipboard for copying slots from one date
  const [clipboardSlots, setClipboardSlots] = useState<DoctorScheduleSlot[] | null>(null)

  const loadDoctor = useCallback(async () => {
    try {
      setFetchLoading(true)
      const doctor = await DoctorsApi.fetchById(doctorId)
      setDoctorName(doctor.name || doctor.email)
      setSlotDuration(doctor.slotDuration || "30")
      // Filter out past dates
      const todayStr = toDateStr(today)
      const existing = (doctor.schedule || []).filter((d) => d.date >= todayStr)
      setSchedule(existing)
    } catch {
      setError("Не удалось загрузить данные врача")
    } finally {
      setFetchLoading(false)
    }
  }, [doctorId, today])

  useEffect(() => {
    loadDoctor()
  }, [loadDoctor])

  /* Schedule helpers */
  const scheduleMap = useMemo(() => {
    const map = new Map<string, DoctorScheduleDate>()
    for (const entry of schedule) {
      map.set(entry.date, entry)
    }
    return map
  }, [schedule])

  const getDateEntry = (dateStr: string) => scheduleMap.get(dateStr)

  const setDateSlots = (dateStr: string, slots: DoctorScheduleSlot[]) => {
    setSaved(false)
    setSchedule((prev) => {
      const idx = prev.findIndex((d) => d.date === dateStr)
      if (slots.length === 0) {
        // Remove the date entry entirely
        if (idx === -1) return prev
        return prev.filter((d) => d.date !== dateStr)
      }
      if (idx === -1) {
        // Add new
        return [...prev, { date: dateStr, slots: sortSlots(slots) }].sort((a, b) =>
          a.date.localeCompare(b.date),
        )
      }
      // Update existing
      const next = [...prev]
      next[idx] = { ...next[idx], slots: sortSlots(slots) }
      return next
    })
  }

  const addSlot = (dateStr: string, time: string) => {
    const entry = getDateEntry(dateStr)
    const slots = entry?.slots || []
    if (slots.some((s) => s.time === time)) return
    setDateSlots(dateStr, [...slots, { time }])
  }

  const removeSlot = (dateStr: string, time: string) => {
    const entry = getDateEntry(dateStr)
    if (!entry) return
    setDateSlots(
      dateStr,
      entry.slots.filter((s) => s.time !== time),
    )
  }

  const clearDate = (dateStr: string) => {
    setDateSlots(dateStr, [])
  }

  const pasteSlots = (dateStr: string) => {
    if (!clipboardSlots) return
    setDateSlots(dateStr, clipboardSlots)
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError("")
      // Only send dates that have slots
      const cleanSchedule = schedule.filter((d) => d.slots.length > 0)
      await DoctorsApi.update(doctorId, { slotDuration, schedule: cleanSchedule } as any)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при сохранении расписания")
    } finally {
      setSaving(false)
    }
  }

  /* Calendar navigation */
  const prevMonth = () => {
    const d = new Date(viewYear, viewMonth - 1, 1)
    // Don't go before current month
    if (d.getFullYear() < today.getFullYear() || (d.getFullYear() === today.getFullYear() && d.getMonth() < today.getMonth())) return
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }

  const nextMonth = () => {
    const d = new Date(viewYear, viewMonth + 1, 1)
    if (d > maxDate) return
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }

  const canPrev =
    viewYear > today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth > today.getMonth())
  const canNext = new Date(viewYear, viewMonth + 1, 1) <= maxDate

  /* Calendar grid */
  const monthDays = getMonthDays(viewYear, viewMonth)
  const firstDayOffset = getMondayIndex(monthDays[0])
  const todayStr = toDateStr(today)

  /* Selected date info */
  const selectedEntry = selectedDate ? getDateEntry(selectedDate) : null
  const selectedSlots = selectedEntry?.slots || []

  if (fetchLoading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex-1 py-8 px-4">
      <div className="max-w-4xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="shrink-0">
            <Link href="/lk-org">
              <ArrowLeft className="w-5 h-5" />
              <span className="sr-only">Назад</span>
            </Link>
          </Button>
          <div className="flex flex-col gap-0.5">
            <h1 className="text-xl font-semibold text-foreground text-balance">
              Расписание: {doctorName}
            </h1>
            <p className="text-sm text-muted-foreground">
              Выберите дату в календаре и добавьте слоты приема
            </p>
          </div>
        </div>

        {/* Slot duration selector */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Длительность слота:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SLOT_DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setSlotDuration(opt.value)
                    setSaved(false)
                  }}
                  className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    slotDuration === opt.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-accent"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main layout: calendar + slot editor */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Calendar */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {/* Month navigation */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <button
                type="button"
                onClick={prevMonth}
                disabled={!canPrev}
                className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Предыдущий месяц"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm font-medium text-foreground">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>
              <button
                type="button"
                onClick={nextMonth}
                disabled={!canNext}
                className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Следующий месяц"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b border-border">
              {WEEKDAY_SHORT.map((wd) => (
                <div
                  key={wd}
                  className="py-2 text-center text-xs font-medium text-muted-foreground"
                >
                  {wd}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 p-2 gap-1">
              {/* Empty offset cells */}
              {Array.from({ length: firstDayOffset }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square" />
              ))}

              {monthDays.map((day) => {
                const dateStr = toDateStr(day)
                const isPast = day < today
                const isFuture = day > maxDate
                const isDisabled = isPast || isFuture
                const isToday = dateStr === todayStr
                const isSelected = dateStr === selectedDate
                const entry = scheduleMap.get(dateStr)
                const hasSlots = entry && entry.slots.length > 0

                return (
                  <button
                    key={dateStr}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`
                      relative aspect-square flex flex-col items-center justify-center rounded-lg text-sm transition-colors
                      ${isDisabled ? "text-muted-foreground/40 cursor-not-allowed" : "hover:bg-accent cursor-pointer"}
                      ${isSelected ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}
                      ${isToday && !isSelected ? "ring-1 ring-primary" : ""}
                    `}
                  >
                    <span className="font-medium">{day.getDate()}</span>
                    {hasSlots && !isSelected && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-primary" />
                    )}
                    {hasSlots && isSelected && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-primary-foreground" />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Legend */}
            <div className="border-t border-border px-4 py-2.5 flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-xs text-muted-foreground">Есть слоты</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full ring-1 ring-primary bg-transparent" />
                <span className="text-xs text-muted-foreground">Сегодня</span>
              </div>
            </div>
          </div>

          {/* Slot editor for selected date */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {selectedDate ? (
              <>
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-foreground capitalize">
                      {formatDateFull(selectedDate)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {selectedSlots.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setClipboardSlots([...selectedSlots])}
                        className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        title="Копировать слоты"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    )}
                    {clipboardSlots && clipboardSlots.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => pasteSlots(selectedDate)}
                        className="gap-1.5 text-xs"
                      >
                        Вставить ({clipboardSlots.length})
                      </Button>
                    )}
                    {selectedSlots.length > 0 && (
                      <button
                        type="button"
                        onClick={() => clearDate(selectedDate)}
                        className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10 transition-colors"
                        title="Очистить день"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-4 flex flex-col gap-4">
                  {/* Slot chips */}
                  {selectedSlots.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedSlots.map((slot) => (
                        <div
                          key={slot.time}
                          className="group flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-1.5 text-sm text-secondary-foreground"
                        >
                          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="font-mono">{slot.time}</span>
                          <button
                            type="button"
                            onClick={() => removeSlot(selectedDate, slot.time)}
                            className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            aria-label={`Удалить слот ${slot.time}`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-2">
                      Нет слотов на эту дату. Добавьте время приема ниже.
                    </p>
                  )}

                  {/* Add slot input */}
                  <AddSlotInput
                    existingSlots={selectedSlots}
                    onAdd={(time) => addSlot(selectedDate, time)}
                  />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 px-4 gap-3">
                <CalendarDays className="w-10 h-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground text-center">
                  Выберите дату в календаре, чтобы настроить слоты приема
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Summary: dates with slots */}
        {schedule.filter((d) => d.slots.length > 0).length > 0 && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="border-b border-border px-4 py-3">
              <span className="text-sm font-medium text-foreground">
                Настроенные даты ({schedule.filter((d) => d.slots.length > 0).length})
              </span>
            </div>
            <div className="p-4 flex flex-wrap gap-2">
              {schedule
                .filter((d) => d.slots.length > 0)
                .map((entry) => (
                  <button
                    key={entry.date}
                    type="button"
                    onClick={() => {
                      const d = parseDate(entry.date)
                      setViewYear(d.getFullYear())
                      setViewMonth(d.getMonth())
                      setSelectedDate(entry.date)
                    }}
                    className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                      selectedDate === entry.date
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-secondary text-secondary-foreground hover:bg-accent"
                    }`}
                  >
                    {formatDateShort(entry.date)} ({entry.slots.length})
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Save button */}
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Сохранение...
              </>
            ) : saved ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Сохранено
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Сохранить расписание
              </>
            )}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/lk-org">Отмена</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  AddSlotInput                                                      */
/* ------------------------------------------------------------------ */

function AddSlotInput({
  existingSlots,
  onAdd,
}: {
  existingSlots: DoctorScheduleSlot[]
  onAdd: (time: string) => void
}) {
  const [value, setValue] = useState("09:00")
  const [inputError, setInputError] = useState("")

  const handleAdd = () => {
    setInputError("")
    if (!value) {
      setInputError("Введите время")
      return
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
      setInputError("Формат: HH:MM (например 09:00)")
      return
    }
    if (existingSlots.some((s) => s.time === value)) {
      setInputError("Такой слот уже существует")
      return
    }
    onAdd(value)
    // Advance +30 min
    const [h, m] = value.split(":").map(Number)
    const totalMin = h * 60 + m + 30
    if (totalMin < 24 * 60) {
      const nh = Math.floor(totalMin / 60)
      const nm = totalMin % 60
      setValue(`${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Input
          type="time"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setInputError("")
          }}
          className="w-32 font-mono"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              handleAdd()
            }
          }}
        />
        <Button type="button" variant="outline" size="sm" onClick={handleAdd} className="gap-1.5">
          <Plus className="w-4 h-4" />
          Добавить
        </Button>
      </div>
      {inputError && <p className="text-xs text-destructive">{inputError}</p>}
    </div>
  )
}
