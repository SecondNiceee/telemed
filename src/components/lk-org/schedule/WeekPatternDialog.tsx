"use client"

import { useState, useCallback, memo } from "react"
import { CalendarRange, Clock, X, Repeat2, Info } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AddSlotInput } from "./AddSlotInput"
import { sortSlots, toDateStr } from "./schedule-helpers"
import type { DoctorScheduleSlot } from "@/lib/api/types"

const WEEK_DAYS = [
  { label: "Понедельник", short: "Пн", index: 1 },
  { label: "Вторник",     short: "Вт", index: 2 },
  { label: "Среда",       short: "Ср", index: 3 },
  { label: "Четверг",     short: "Чт", index: 4 },
  { label: "Пятница",     short: "Пт", index: 5 },
  { label: "Суббота",     short: "Сб", index: 6 },
  { label: "Воскресенье", short: "Вс", index: 0 },
]

type WeekPattern = Record<number, DoctorScheduleSlot[]> // day index 0–6 → slots

interface WeekPatternDialogProps {
  open: boolean
  onClose: () => void
  today: Date
  maxDate: Date
  onApply: (entries: { date: string; slots: DoctorScheduleSlot[] }[]) => void
}

export const WeekPatternDialog = memo(function WeekPatternDialog({
  open,
  onClose,
  today,
  maxDate,
  onApply,
}: WeekPatternDialogProps) {
  const [pattern, setPattern] = useState<WeekPattern>({})
  const [activeDayIdx, setActiveDayIdx] = useState<number>(1)

  const activeSlots = pattern[activeDayIdx] ?? []

  const addSlot = useCallback((time: string) => {
    setPattern((prev) => {
      const slots = prev[activeDayIdx] ?? []
      if (slots.some((s) => s.time === time)) return prev
      return { ...prev, [activeDayIdx]: sortSlots([...slots, { time }]) }
    })
  }, [activeDayIdx])

  const removeSlot = useCallback((time: string) => {
    setPattern((prev) => {
      const slots = (prev[activeDayIdx] ?? []).filter((s) => s.time !== time)
      return { ...prev, [activeDayIdx]: slots }
    })
  }, [activeDayIdx])

  const clearDay = useCallback(() => {
    setPattern((prev) => ({ ...prev, [activeDayIdx]: [] }))
  }, [activeDayIdx])

  const totalDays = WEEK_DAYS.filter((d) => (pattern[d.index] ?? []).length > 0).length
  const totalSlots = WEEK_DAYS.reduce((acc, d) => acc + (pattern[d.index] ?? []).length, 0)

  // Count how many real calendar days will be filled
  const previewCount = (() => {
    let count = 0
    const cur = new Date(today)
    while (cur <= maxDate) {
      const dayIdx = cur.getDay()
      if ((pattern[dayIdx] ?? []).length > 0) count++
      cur.setDate(cur.getDate() + 1)
    }
    return count
  })()

  const handleApply = useCallback(() => {
    const entries: { date: string; slots: DoctorScheduleSlot[] }[] = []
    const cur = new Date(today)
    while (cur <= maxDate) {
      const dayIdx = cur.getDay()
      const slots = pattern[dayIdx] ?? []
      if (slots.length > 0) {
        entries.push({ date: toDateStr(cur), slots: [...slots] })
      }
      cur.setDate(cur.getDate() + 1)
    }
    onApply(entries)
    onClose()
  }, [pattern, today, maxDate, onApply, onClose])

  const hasAnySlot = totalSlots > 0

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl w-full p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <CalendarRange className="w-5 h-5 text-primary" />
            Паттерн расписания на год
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Настройте слоты для каждого дня недели — они автоматически заполнят весь год
          </p>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border">
          {/* Day selector */}
          <div className="sm:w-44 flex sm:flex-col gap-1 p-3 sm:p-4 overflow-x-auto sm:overflow-x-visible shrink-0">
            {WEEK_DAYS.map((day) => {
              const count = (pattern[day.index] ?? []).length
              const isActive = activeDayIdx === day.index
              return (
                <button
                  key={day.index}
                  type="button"
                  onClick={() => setActiveDayIdx(day.index)}
                  className={[
                    "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-accent",
                  ].join(" ")}
                >
                  <span className="hidden sm:inline">{day.label}</span>
                  <span className="sm:hidden">{day.short}</span>
                  {count > 0 && (
                    <span
                      className={[
                        "ml-2 text-xs rounded-full px-1.5 py-0.5 font-mono",
                        isActive
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-primary/15 text-primary",
                      ].join(" ")}
                    >
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Slot editor for active day */}
          <div className="flex-1 flex flex-col gap-4 p-4 sm:p-6 min-h-[260px]">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                {WEEK_DAYS.find((d) => d.index === activeDayIdx)?.label}
              </span>
              {activeSlots.length > 0 && (
                <button
                  type="button"
                  onClick={clearDay}
                  className="text-xs text-destructive hover:underline"
                >
                  Очистить
                </button>
              )}
            </div>

            {activeSlots.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {activeSlots.map((slot) => (
                  <div
                    key={slot.time}
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-1.5 text-sm text-secondary-foreground"
                  >
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="font-mono">{slot.time}</span>
                    <button
                      type="button"
                      onClick={() => removeSlot(slot.time)}
                      className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                      aria-label={`Удалить ${slot.time}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Добавьте слоты для этого дня недели
              </p>
            )}

            <AddSlotInput existingSlots={activeSlots} onAdd={addSlot} />
          </div>
        </div>

        {/* Preview banner */}
        {hasAnySlot && (
          <div className="px-6 py-3 bg-primary/5 border-t border-primary/10 flex items-center gap-2 text-sm text-primary">
            <Info className="w-4 h-4 shrink-0" />
            <span>
              Будет заполнено <strong>{previewCount}</strong> дней
              ({totalDays} {totalDays === 1 ? "день" : totalDays < 5 ? "дня" : "дней"} недели,{" "}
              {totalSlots} {totalSlots === 1 ? "слот" : totalSlots < 5 ? "слота" : "слотов"} каждую неделю)
            </span>
          </div>
        )}

        <DialogFooter className="px-6 py-4 border-t border-border flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button
            onClick={handleApply}
            disabled={!hasAnySlot}
            className="gap-2"
          >
            <Repeat2 className="w-4 h-4" />
            Применить на год
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
