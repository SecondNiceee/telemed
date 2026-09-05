"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AdminRequisitesForm, type RequisitesFormValues } from "./admin-requisites-form"
import type { AdminUser } from "./types"

interface AdminRequisitesScreenProps {
  admin: AdminUser
  initialValues: RequisitesFormValues
}

export function AdminRequisitesScreen({ admin, initialValues }: AdminRequisitesScreenProps) {
  return (
    <main className="min-h-screen bg-background">
      <header className="bg-[var(--surface-dark)] text-primary-foreground">
        <div className="mx-auto max-w-5xl px-6 py-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-lg font-semibold tracking-tight">smartcardio</p>
            <p className="text-xs text-primary-foreground/60">Реквизиты оператора</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium">{admin.name || "Администратор"}</p>
              <p className="text-xs text-primary-foreground/60">{admin.email}</p>
            </div>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10"
            >
              <Link href="/admin">
                <ArrowLeft className="size-4" />
                <span className="hidden sm:inline">К организациям</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10">
        <AdminRequisitesForm initialValues={initialValues} />
      </div>
    </main>
  )
}
