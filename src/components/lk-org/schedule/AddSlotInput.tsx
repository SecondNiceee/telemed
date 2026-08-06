"use client"

import { useState, memo, useCallback } from "react"
import { Plus, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
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

  const handleAdd = useCallback(() => {
    setInputError("")
    if (existingSlots.some((s) => s.time === value)) {
      setInputError("Такой слот уже существует")
      return
    }
    onAdd(value)
    setOpen(false)

    // Advance +30 min for next slot
    const [h, m] = value.split(":").map(Number)
    const totalMin = h * 60 + m + 30
    if (totalMin < 24 * 60) {
      const nh = Math.floor(totalMin / 60)
      const nm = totalMin % 60
      setValue(`${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`)
    }
  }, [value, existingSlots, onAdd])

  const handleOpen = useCallback(() => {
    setInputError("")
    setOpen(true)
  }, [])

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleOpen}
        className="gap-2"
      >
        <Clock className="w-4 h-4" />
        {value}
        <Plus className="w-3.5 h-3.5 text-muted-foreground" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xs p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="text-base font-semibold">
              Выбор времени
            </DialogTitle>
          </DialogHeader>

          <div className="px-6 py-4">
            <ClockPicker value={value} onChange={setValue} />
            {inputError && (
              <p className="mt-2 text-center text-xs text-destructive">
                {inputError}
              </p>
            )}
          </div>

          <DialogFooter className="px-6 pb-6 gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Отмена
            </Button>
            <Button type="button" size="sm" onClick={handleAdd} className="flex-1">
              <Plus className="w-4 h-4 mr-1" />
              Добавить {value}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
})
