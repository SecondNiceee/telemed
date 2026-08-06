"use client"

import { memo, useCallback } from "react"
import type { DoctorScheduleDate } from "@/lib/api/types"
import { formatDateShort, parseDate } from "./schedule-helpers"

interface ScheduleSummaryProps {
  schedule: DoctorScheduleDate[]
  selectedDate: string | null
  onSelectDate: (dateStr: string, year: number, month: number) => void
}

export const ScheduleSummary = memo(function ScheduleSummary({
  schedule,
  selectedDate,
  onSelectDate,
}: ScheduleSummaryProps) {
  const datesWithSlots = schedule.filter((d) => d.slots.length > 0)

  if (datesWithSlots.length === 0) return null

  const handleClick = 
    (dateStr: string) => {
      const d = parseDate(dateStr)
      onSelectDate(dateStr, d.getFullYear(), d.getMonth())
    }
    

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <span className="text-sm font-medium text-foreground">
          Настроенные даты ({datesWithSlots.length})
        </span>
      </div>
      <div className="p-4 flex flex-wrap gap-2">
        {datesWithSlots.map((entry) => (
          <button
            key={entry.date}
            type="button"
            onClick={() => handleClick(entry.date)}
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
  )
})
