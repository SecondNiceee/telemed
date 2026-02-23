"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DoctorsApi } from "@/lib/api/doctors"
import type { DoctorScheduleDay, DoctorScheduleSlot, DayOfWeek } from "@/lib/api/types"
import {
  ArrowLeft,
  Loader2,
  Plus,
  X,
  Clock,
  CalendarDays,
  Save,
  CheckCircle2,
} from "lucide-react"
import Link from "next/link"

const DAYS_OF_WEEK: { value: DayOfWeek; label: string; short: string }[] = [
  { value: "monday", label: "Понедельник", short: "Пн" },
  { value: "tuesday", label: "Вторник", short: "Вт" },
  { value: "wednesday", label: "Среда", short: "Ср" },
  { value: "thursday", label: "Четверг", short: "Чт" },
  { value: "friday", label: "Пятница", short: "Пт" },
  { value: "saturday", label: "Суббота", short: "Сб" },
  { value: "sunday", label: "Воскресенье", short: "Вс" },
]

function buildEmptySchedule(): DoctorScheduleDay[] {
  return DAYS_OF_WEEK.map((d) => ({
    day: d.value,
    enabled: d.value !== "saturday" && d.value !== "sunday",
    slots: [],
  }))
}

function mergeSchedule(existing: DoctorScheduleDay[] | null | undefined): DoctorScheduleDay[] {
  const base = buildEmptySchedule()
  if (!existing || existing.length === 0) return base

  return base.map((dayTemplate) => {
    const found = existing.find((e) => e.day === dayTemplate.day)
    if (found) {
      return {
        ...dayTemplate,
        enabled: found.enabled,
        slots: (found.slots || []).map((s) => ({ time: s.time })),
      }
    }
    return dayTemplate
  })
}

function sortSlots(slots: DoctorScheduleSlot[]): DoctorScheduleSlot[] {
  return [...slots].sort((a, b) => a.time.localeCompare(b.time))
}

interface LkOrgDoctorScheduleProps {
  doctorId: number
  orgId: number
}

export function LkOrgDoctorSchedule({ doctorId, orgId }: LkOrgDoctorScheduleProps) {
  const router = useRouter()
  const [schedule, setSchedule] = useState<DoctorScheduleDay[]>(buildEmptySchedule())
  const [doctorName, setDoctorName] = useState("")
  const [fetchLoading, setFetchLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")
  const [activeDay, setActiveDay] = useState<DayOfWeek>("monday")

  const loadDoctor = useCallback(async () => {
    try {
      setFetchLoading(true)
      const doctor = await DoctorsApi.fetchById(doctorId)
      setDoctorName(doctor.name || doctor.email)
      setSchedule(mergeSchedule(doctor.schedule))
    } catch {
      setError("Не удалось загрузить данные врача")
    } finally {
      setFetchLoading(false)
    }
  }, [doctorId])

  useEffect(() => {
    loadDoctor()
  }, [loadDoctor])

  const toggleDay = (day: DayOfWeek) => {
    setSchedule((prev) =>
      prev.map((d) => (d.day === day ? { ...d, enabled: !d.enabled } : d)),
    )
    setSaved(false)
  }

  const addSlot = (day: DayOfWeek, time: string) => {
    setSchedule((prev) =>
      prev.map((d) => {
        if (d.day !== day) return d
        // Avoid duplicate
        if (d.slots.some((s) => s.time === time)) return d
        return { ...d, slots: sortSlots([...d.slots, { time }]) }
      }),
    )
    setSaved(false)
  }

  const removeSlot = (day: DayOfWeek, time: string) => {
    setSchedule((prev) =>
      prev.map((d) => {
        if (d.day !== day) return d
        return { ...d, slots: d.slots.filter((s) => s.time !== time) }
      }),
    )
    setSaved(false)
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError("")
      await DoctorsApi.update(doctorId, { schedule } as any)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при сохранении расписания")
    } finally {
      setSaving(false)
    }
  }

  const activeDayData = schedule.find((d) => d.day === activeDay)
  const activeDayInfo = DAYS_OF_WEEK.find((d) => d.value === activeDay)!

  if (fetchLoading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex-1 py-8 px-4">
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
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
              Настройте еженедельный шаблон приема
            </p>
          </div>
        </div>

        {/* Day tabs */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Дни недели</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 p-4">
            {DAYS_OF_WEEK.map((d) => {
              const dayData = schedule.find((s) => s.day === d.value)
              const isActive = activeDay === d.value
              const isEnabled = dayData?.enabled ?? false
              const slotCount = dayData?.slots.length ?? 0

              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setActiveDay(d.value)}
                  className={`
                    relative flex flex-col items-center rounded-lg px-3 py-2 text-sm transition-colors
                    ${isActive
                      ? "bg-primary text-primary-foreground"
                      : isEnabled
                        ? "bg-secondary text-secondary-foreground hover:bg-accent"
                        : "bg-muted text-muted-foreground hover:bg-accent"
                    }
                  `}
                >
                  <span className="font-medium">{d.short}</span>
                  {isEnabled && slotCount > 0 && (
                    <span className={`text-[10px] leading-tight mt-0.5 ${isActive ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                      {slotCount} {slotCount === 1 ? "слот" : slotCount < 5 ? "слота" : "слотов"}
                    </span>
                  )}
                  {!isEnabled && (
                    <span className={`text-[10px] leading-tight mt-0.5 ${isActive ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                      вых.
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Active day editor */}
        {activeDayData && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">
                  {activeDayInfo.label}
                </span>
              </div>
              <button
                type="button"
                onClick={() => toggleDay(activeDay)}
                className={`
                  relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors
                  ${activeDayData.enabled ? "bg-primary" : "bg-muted"}
                `}
                role="switch"
                aria-checked={activeDayData.enabled}
                aria-label={`${activeDayInfo.label} -- ${activeDayData.enabled ? "рабочий день" : "выходной"}`}
              >
                <span
                  className={`
                    inline-block h-4 w-4 rounded-full bg-card shadow transition-transform
                    ${activeDayData.enabled ? "translate-x-6" : "translate-x-1"}
                  `}
                />
              </button>
            </div>

            {activeDayData.enabled ? (
              <div className="p-4 flex flex-col gap-4">
                {/* Slot list */}
                {activeDayData.slots.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {activeDayData.slots.map((slot) => (
                      <div
                        key={slot.time}
                        className="group flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-1.5 text-sm text-secondary-foreground"
                      >
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="font-mono">{slot.time}</span>
                        <button
                          type="button"
                          onClick={() => removeSlot(activeDay, slot.time)}
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
                    Нет добавленных слотов. Добавьте время приема ниже.
                  </p>
                )}

                {/* Add slot */}
                <AddSlotInput
                  existingSlots={activeDayData.slots}
                  onAdd={(time) => addSlot(activeDay, time)}
                />
              </div>
            ) : (
              <div className="p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Выходной день. Включите переключатель, чтобы добавить слоты.
                </p>
              </div>
            )}
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
          <Button
            onClick={handleSave}
            disabled={saving}
            className="gap-2"
          >
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
/*  Small sub-component: input for adding a new time slot             */
/* ------------------------------------------------------------------ */

function AddSlotInput({
  existingSlots,
  onAdd,
}: {
  existingSlots: DoctorScheduleSlot[]
  onAdd: (time: string) => void
}) {
  const [value, setValue] = useState("09:00")
  const [error, setError] = useState("")

  const handleAdd = () => {
    setError("")
    if (!value) {
      setError("Введите время")
      return
    }
    // Validate HH:MM
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
      setError("Формат: HH:MM (например 09:00)")
      return
    }
    if (existingSlots.some((s) => s.time === value)) {
      setError("Такой слот уже существует")
      return
    }
    onAdd(value)
    // Advance to next 30 min for convenience
    const [h, m] = value.split(":").map(Number)
    const next = m >= 30 ? `${String(h + 1).padStart(2, "0")}:00` : `${String(h).padStart(2, "0")}:30`
    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(next)) {
      setValue(next)
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
            setError("")
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
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
