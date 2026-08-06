"use client"

import Link from "next/link"
import { Stethoscope, UserPlus, LogOut, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { memo } from "react"
import { useOrgStore } from "@/stores/org-store"

interface OrgPageHeaderProps {
  userName: string
}

export const OrgPageHeader = memo(function OrgPageHeader({ userName }: OrgPageHeaderProps) {
  const logout = useOrgStore((s) => s.logout)
  const loading = useOrgStore((s) => s.loading)

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
        <Button
          variant="outline"
          size="sm"
          className="gap-2 shrink-0"
          onClick={() => {
            logout();
          }}
          disabled={loading}
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Выйти</span>
        </Button>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" className="gap-2">
          <Link href="/lk-org/categories">
            <Stethoscope className="w-4 h-4" />
            Специальности
          </Link>
        </Button>
        <Button asChild className="gap-2">
          <Link href="/lk-org/doctor-create">
            <UserPlus className="w-4 h-4" />
            Добавить врача
          </Link>
        </Button>
      </div>
    </div>
  )
})
