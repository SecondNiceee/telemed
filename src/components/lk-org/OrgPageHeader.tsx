"use client"

import Link from "next/link"
import { UserPlus, Building2, Home, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { memo } from "react"

interface OrgPageHeaderProps {
  userName: string
}

export const OrgPageHeader = memo(function OrgPageHeader({ userName }: OrgPageHeaderProps) {
  return (
    <div className="mb-8">
      {/* Title block */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
              Кабинет организации
            </p>
            <h1 className="text-xl font-bold text-foreground text-balance">
              Добро пожаловать, {userName}
            </h1>
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-2 shrink-0">
          <Link href="/">
            <Home className="w-4 h-4" />
            <span className="hidden sm:inline">Вернуться на сайт</span>
          </Link>
        </Button>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/lk-org/doctor-create">
            <UserPlus data-icon="inline-start" />
            Добавить врача
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/lk-org/settings">
            <Settings data-icon="inline-start" />
            Настройки организации
          </Link>
        </Button>
      </div>
    </div>
  )
})
