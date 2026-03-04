"use client"

import Link from "next/link"
import { Stethoscope, UserPlus, LogOut } from "lucide-react"
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
    <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground text-balance">
          Кабинет организации
        </h1>
        <p className="text-muted-foreground mt-1">Добро пожаловать, {userName}</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <Button asChild variant="outline" className="gap-2">
          <Link href="/lk-org/categories">
            <Stethoscope className="w-4 h-4" />
            <span className="hidden sm:inline">Специальности</span>
          </Link>
        </Button>
        <Button asChild className="gap-2">
          <Link href="/lk-org/doctor-create">
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline">Создать врача</span>
          </Link>
        </Button>
        <Button variant="outline" className="gap-2" onClick={logout} disabled={loading}>
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Выйти</span>
        </Button>
      </div>
    </div>
  )
})
