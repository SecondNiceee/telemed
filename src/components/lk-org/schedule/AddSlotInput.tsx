"use client"

import { useState, memo, useCallback, useRef, useEffect } from "react"
import { Plus, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { DoctorScheduleSlot } from "@/lib/api/types"
import { ClockPicker } from "./ClockPicker"

interface AddSlotInputProps {
  existingSlots: DoctorScheduleSlot[]
  onAdd: (time: string) => void
}

export const AddSlotInput = memo(function AddSlotInput({
  existingSlots,
  onAdd,
}: AddSlotInputProps) {
  const [value, setValue] = useState("09:00")
  const [inputError, setInputError] = useState("")
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleOutside)
    return () => document.removeEventListener("mousedown", handleOutside)
  }, [open])

  const handleAdd = useCallback(() => {
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
    setOpen(false)
    // Advance +30 min
    const [h, m] = value.split(":").map(Number)
    const totalMin = h * 60 + m + 30
    if (totalMin < 24 * 60) {
      const nh = Math.floor(totalMin / 60)
      const nm = totalMin % 60
      setValue(`${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`)
    }
  }, [value, existingSlots, onAdd])

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        {/* Clock trigger button */}
        <div ref={containerRef} className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-mono font-medium transition-colors
              ${open
                ? "border-primary bg-primary/5 text-primary"
                : "border-border bg-secondary text-foreground hover:border-primary/50 hover:bg-primary/5"
              }`}
          >
            <Clock className="w-4 h-4 flex-shrink-0" />
            <span>{value}</span>
          </button>

          {open && (
            <div
              className="absolute bottom-full left-0 z-50 mb-2 rounded-2xl border border-border bg-card p-4 shadow-xl"
              style={{ minWidth: 256 }}
            >
              <ClockPicker value={value} onChange={setValue} />
              <div className="mt-3 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpen(false)}
                >
                  Отмена
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAdd}
                >
                  Выбрать
                </Button>
              </div>
            </div>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
          className="gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Добавить
        </Button>
      </div>
      {inputError && <p className="text-xs text-destructive">{inputError}</p>}
    </div>
  )
})
