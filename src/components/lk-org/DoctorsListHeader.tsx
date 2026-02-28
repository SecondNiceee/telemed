"use client"

import { Users } from "lucide-react"
import { memo } from "react"

interface DoctorsListHeaderProps {
  count: number
}

function pluralDoctors(n: number): string {
  if (n === 1) return "врач"
  if (n >= 2 && n <= 4) return "врача"
  return "врачей"
}

export const DoctorsListHeader = memo(function DoctorsListHeader({ count }: DoctorsListHeaderProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
        <Users className="w-5 h-5 text-primary" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-foreground">Врачи</h2>
        <p className="text-sm text-muted-foreground">
          {count === 0
            ? "Пока нет добавленных врачей"
            : `${count} ${pluralDoctors(count)}`}
        </p>
      </div>
    </div>
  )
})
