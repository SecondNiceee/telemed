"use client"

import { useState, memo, useCallback } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { DoctorScheduleSlot } from "@/lib/api/types"

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
})
