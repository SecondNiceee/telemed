"use client"

import { memo, useCallback, useMemo } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { DoctorScheduleDate } from "@/lib/api/types"
import {
  MONTH_NAMES,
  WEEKDAY_SHORT,
  toDateStr,
  getMonthDays,
  getMondayIndex,
} from "./schedule-helpers"

interface ScheduleCalendarProps {
  viewYear: number
  viewMonth: number
  today: Date
  maxDate: Date
  selectedDate: string | null
  scheduleMap: Map<string, DoctorScheduleDate>
  canPrev: boolean
  canNext: boolean
  onPrevMonth: () => void
  onNextMonth: () => void
  onSelectDate: (dateStr: string) => void
}

export const ScheduleCalendar = memo(function ScheduleCalendar({
  viewYear,
  viewMonth,
  today,
  maxDate,
  selectedDate,
  scheduleMap,
  canPrev,
  canNext,
  onPrevMonth,
  onNextMonth,
  onSelectDate,
}: ScheduleCalendarProps) {
  const todayStr = toDateStr(today)
  const monthDays = useMemo(() => getMonthDays(viewYear, viewMonth), [viewYear, viewMonth])
  const firstDayOffset = getMondayIndex(monthDays[0])

  const handleSelect = useCallback(
    (dateStr: string) => onSelectDate(dateStr),
    [onSelectDate],
  )

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Month navigation */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={onPrevMonth}
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
          onClick={onNextMonth}
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
          <div key={wd} className="py-2 text-center text-xs font-medium text-muted-foreground">
            {wd}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 p-2 gap-1">
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
          const hasSlots = (scheduleMap.get(dateStr)?.slots.length ?? 0) > 0

          return (
            <button
              key={dateStr}
              type="button"
              disabled={isDisabled}
              onClick={() => handleSelect(dateStr)}
              className={[
                "relative aspect-square flex flex-col items-center justify-center rounded-lg text-sm transition-colors",
                isDisabled
                  ? "text-muted-foreground/40 cursor-not-allowed"
                  : "hover:bg-accent cursor-pointer",
                isSelected ? "bg-primary text-primary-foreground hover:bg-primary/90" : "",
                isToday && !isSelected ? "ring-1 ring-primary" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="font-medium">{day.getDate()}</span>
              {hasSlots && (
                <span
                  className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${
                    isSelected ? "bg-primary-foreground" : "bg-primary"
                  }`}
                />
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
  )
})
