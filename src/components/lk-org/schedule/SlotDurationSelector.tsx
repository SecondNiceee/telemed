"use client"

import { memo } from "react"
import { Clock } from "lucide-react"
import { SLOT_DURATION_OPTIONS } from "./schedule-helpers"

interface SlotDurationSelectorProps {
  value: string
  onChange: (v: string) => void
}

export const SlotDurationSelector = memo(function SlotDurationSelector({
  value,
  onChange,
}: SlotDurationSelectorProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            Длительность консультаций:
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SLOT_DURATION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                value === opt.value
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
  )
})
