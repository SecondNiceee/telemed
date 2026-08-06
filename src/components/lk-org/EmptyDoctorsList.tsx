"use client"

import Link from "next/link"
import { User, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { memo } from "react"

export const EmptyDoctorsList = memo(function EmptyDoctorsList() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-10 flex flex-col items-center justify-center gap-4">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
        <User className="w-8 h-8 text-muted-foreground" />
      </div>
      <div className="text-center">
        <p className="text-foreground font-medium">Нет врачей</p>
        <p className="text-sm text-muted-foreground mt-1">
          Добавьте первого врача, чтобы начать работу
        </p>
      </div>
      <Button asChild className="gap-2">
        <Link href="/lk-org/doctor-create">
          <UserPlus className="w-4 h-4" />
          Добавить врача
        </Link>
      </Button>
    </div>
  )
})
