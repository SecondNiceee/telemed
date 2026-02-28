"use client"

import { memo } from "react"
import Link from "next/link"
import { Loader2, Save, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SaveScheduleBarProps {
  saving: boolean
  saved: boolean
  error: string
  onSave: () => void
}

export const SaveScheduleBar = memo(function SaveScheduleBar({
  saving,
  saved,
  error,
  onSave,
}: SaveScheduleBarProps) {
  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
      <div className="flex items-center gap-3">
        <Button onClick={onSave} disabled={saving} className="gap-2">
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Сохранение...
            </>
          ) : saved ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Сохранено
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Сохранить расписание
            </>
          )}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/lk-org">Отмена</Link>
        </Button>
      </div>
    </div>
  )
})
