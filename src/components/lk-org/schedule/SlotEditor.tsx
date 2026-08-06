"use client"

import { memo, useCallback } from "react"
import { CalendarDays, Clock, X, Copy, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { DoctorScheduleSlot } from "@/lib/api/types"
import { formatDateFull } from "./schedule-helpers"
import { AddSlotInput } from "./AddSlotInput"

interface SlotEditorProps {
  selectedDate: string
  slots: DoctorScheduleSlot[]
  clipboardSlots: DoctorScheduleSlot[] | null
  onRemoveSlot: (time: string) => void
  onClearDate: () => void
  onCopySlots: () => void
  onPasteSlots: () => void
  onAddSlot: (time: string) => void
}

export const SlotEditor = memo(function SlotEditor({
  selectedDate,
  slots,
  clipboardSlots,
  onRemoveSlot,
  onClearDate,
  onCopySlots,
  onPasteSlots,
  onAddSlot,
}: SlotEditorProps) {
  const handleRemove = useCallback(
    (time: string) => onRemoveSlot(time),
    [onRemoveSlot],
  ) 

  return (
    <div className="rounded-xl border border-border bg-card ">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground capitalize">
            {formatDateFull(selectedDate)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {slots.length > 0 && (
            <button
              type="button"
              onClick={onCopySlots}
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
              onClick={onPasteSlots}
              className="gap-1.5 text-xs"
            >
              Вставить ({clipboardSlots.length})
            </Button>
          )}
          {slots.length > 0 && (
            <button
              type="button"
              onClick={onClearDate}
              className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10 transition-colors"
              title="Очистить день"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {slots.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {slots.map((slot) => (
              <div
                key={slot.time}
                className="group flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-1.5 text-sm text-secondary-foreground"
              >
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="font-mono">{slot.time}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(slot.time)}
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

        <AddSlotInput existingSlots={slots} onAdd={onAddSlot} />
      </div>
    </div>
  )
})
