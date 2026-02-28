"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, CalendarDays, CalendarRange } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSchedule } from "@/components/lk-org/schedule/useSchedule"
import { SlotDurationSelector } from "@/components/lk-org/schedule/SlotDurationSelector"
import { ScheduleCalendar } from "@/components/lk-org/schedule/ScheduleCalendar"
import { SlotEditor } from "@/components/lk-org/schedule/SlotEditor"
import { ScheduleSummary } from "@/components/lk-org/schedule/ScheduleSummary"
import { SaveScheduleBar } from "@/components/lk-org/schedule/SaveScheduleBar"
import { WeekPatternDialog } from "@/components/lk-org/schedule/WeekPatternDialog"
import type { DoctorScheduleSlot } from "@/lib/api/types"

interface LkOrgDoctorScheduleProps {
  doctorId: number
  orgId: number
}

export function LkOrgDoctorSchedule({ doctorId }: LkOrgDoctorScheduleProps) {
  const {
    schedule,
    slotDuration,
    setSlotDuration,
    doctorName,
    fetchLoading,
    saving,
    saved,
    error,
    scheduleMap,
    getDateEntry,
    addSlot,
    removeSlot,
    clearDate,
    setDateSlots,
    handleSave,
    today,
    maxDate,
  } = useSchedule(doctorId)

  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [clipboardSlots, setClipboardSlots] = useState<
    { time: string }[] | null
  >(null)
  const [patternOpen, setPatternOpen] = useState(false)

  const handleApplyPattern = useCallback(
    (entries: { date: string; slots: DoctorScheduleSlot[] }[]) => {
      for (const entry of entries) {
        setDateSlots(entry.date, entry.slots)
      }
    },
    [setDateSlots],
  )

  const canPrev =
    viewYear > today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth > today.getMonth())
  const canNext = new Date(viewYear, viewMonth + 1, 1) <= maxDate

  const handlePrevMonth = useCallback(() => {
    const d = new Date(viewYear, viewMonth - 1, 1)
    if (
      d.getFullYear() < today.getFullYear() ||
      (d.getFullYear() === today.getFullYear() && d.getMonth() < today.getMonth())
    )
      return
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }, [viewYear, viewMonth, today])

  const handleNextMonth = useCallback(() => {
    const d = new Date(viewYear, viewMonth + 1, 1)
    if (d > maxDate) return
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }, [viewYear, viewMonth, maxDate])

  const handleSummarySelectDate = useCallback(
    (dateStr: string, year: number, month: number) => {
      setViewYear(year)
      setViewMonth(month)
      setSelectedDate(dateStr)
    },
    [],
  )

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
          <div className="flex flex-col gap-0.5 flex-1">
            <h1 className="text-xl font-semibold text-foreground text-balance">
              Расписание: {doctorName}
            </h1>
            <p className="text-sm text-muted-foreground">
              Выберите дату в календаре и добавьте слоты приема
            </p>
          </div>
          <Button
            variant="outline"
            className="gap-2 shrink-0"
            onClick={() => setPatternOpen(true)}
          >
            <CalendarRange className="w-4 h-4" />
            <span className="hidden sm:inline">Создать паттерн</span>
            <span className="sm:hidden">Паттерн</span>
          </Button>
        </div>

        <SlotDurationSelector value={slotDuration} onChange={setSlotDuration} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ScheduleCalendar
            viewYear={viewYear}
            viewMonth={viewMonth}
            today={today}
            maxDate={maxDate}
            selectedDate={selectedDate}
            scheduleMap={scheduleMap}
            canPrev={canPrev}
            canNext={canNext}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            onSelectDate={setSelectedDate}
          />

          {selectedDate ? (
            <SlotEditor
              selectedDate={selectedDate}
              slots={selectedSlots}
              clipboardSlots={clipboardSlots}
              onRemoveSlot={(time) => removeSlot(selectedDate, time)}
              onClearDate={() => clearDate(selectedDate)}
              onCopySlots={() => setClipboardSlots([...selectedSlots])}
              onPasteSlots={() =>
                clipboardSlots && setDateSlots(selectedDate, clipboardSlots)
              }
              onAddSlot={(time) => addSlot(selectedDate, time)}
            />
          ) : (
            <div className="rounded-xl border border-border bg-card flex flex-col items-center justify-center py-16 px-4 gap-3">
              <CalendarDays className="w-10 h-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground text-center">
                Выберите дату в календаре, чтобы настроить слоты приема
              </p>
            </div>
          )}
        </div>

        <ScheduleSummary
          schedule={schedule}
          selectedDate={selectedDate}
          onSelectDate={handleSummarySelectDate}
        />

        <SaveScheduleBar
          saving={saving}
          saved={saved}
          error={error}
          onSave={handleSave}
        />
      </div>

      <WeekPatternDialog
        open={patternOpen}
        onClose={() => setPatternOpen(false)}
        today={today}
        maxDate={maxDate}
        onApply={handleApplyPattern}
      />
    </div>
  )
}
