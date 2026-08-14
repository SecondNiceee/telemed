"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Building2, KeyRound, LogOut, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { AdminCreateOrgDialog } from "./admin-create-org-dialog"
import { AdminCredentialsDialog } from "./admin-credentials-dialog"
import type { AdminOrganisation, AdminUser, IssuedCredentials } from "./types"

interface AdminOrganisationsProps {
  admin: AdminUser
  initialOrganisations: AdminOrganisation[]
  onSignedOut: () => void
}

export function AdminOrganisations({
  admin,
  initialOrganisations,
  onSignedOut,
}: AdminOrganisationsProps) {
  const [organisations, setOrganisations] = useState(initialOrganisations)
  const [createOpen, setCreateOpen] = useState(false)
  const [credentials, setCredentials] = useState<IssuedCredentials | null>(null)
  const [resetTarget, setResetTarget] = useState<AdminOrganisation | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminOrganisation | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const handleCreated = (org: AdminOrganisation, issued: IssuedCredentials) => {
    setOrganisations((prev) => [org, ...prev])
    setCredentials(issued)
  }

  const resetPassword = async (org: AdminOrganisation) => {
    setBusyId(String(org.id))
    try {
      const res = await fetch(`/api/admin/organisations/${org.id}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || "Не удалось сбросить пароль")
      setCredentials({
        organisationName: org.name,
        email: data.credentials.email,
        password: data.credentials.password,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сбросить пароль")
    } finally {
      setBusyId(null)
      setResetTarget(null)
    }
  }

  const deleteOrg = async (org: AdminOrganisation) => {
    setBusyId(String(org.id))
    try {
      const res = await fetch(`/api/admin/organisations/${org.id}`, {
        method: "DELETE",
        credentials: "include",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || "Не удалось удалить организацию")
      setOrganisations((prev) => prev.filter((item) => String(item.id) !== String(org.id)))
      toast.success("Организация удалена")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось удалить организацию")
    } finally {
      setBusyId(null)
      setDeleteTarget(null)
    }
  }

  const signOut = async () => {
    await fetch("/api/users/logout", { method: "POST", credentials: "include" })
    onSignedOut()
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="bg-[var(--surface-dark)] text-primary-foreground">
        <div className="mx-auto max-w-5xl px-6 py-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-lg font-semibold tracking-tight">smartcardio</p>
            <p className="text-xs text-primary-foreground/60">Панель администратора</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium">{admin.name || "Администратор"}</p>
              <p className="text-xs text-primary-foreground/60">{admin.email}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10"
            >
              <LogOut className="size-4" />
              <span className="sr-only sm:not-sr-only">Выйти</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Организации</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {organisations.length === 0
                ? "Пока не создано ни одной организации"
                : `Всего: ${organisations.length}`}
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            Создать организацию
          </Button>
        </div>

        <div className="mt-8">
          {organisations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-6 py-16 flex flex-col items-center text-center gap-3">
              <Building2 className="size-8 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground max-w-xs text-pretty">
                Создайте организацию, чтобы выдать ей доступ в кабинет и добавить врачей.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {organisations.map((org) => (
                <li
                  key={org.id}
                  className="rounded-xl border border-border bg-card px-5 py-4 flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-card-foreground truncate">{org.name}</p>
                    <p className="text-sm text-muted-foreground font-mono truncate">{org.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busyId === String(org.id)}
                      onClick={() => setResetTarget(org)}
                    >
                      <KeyRound className="size-4" />
                      Новый пароль
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busyId === String(org.id)}
                      onClick={() => setDeleteTarget(org)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                      <span className="sr-only">Удалить {org.name}</span>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <AdminCreateOrgDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={handleCreated} />

      <AdminCredentialsDialog
        credentials={credentials}
        onClose={() => setCredentials(null)}
      />

      <AlertDialog open={Boolean(resetTarget)} onOpenChange={(open) => !open && setResetTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Сбросить пароль организации?</AlertDialogTitle>
            <AlertDialogDescription>
              Для «{resetTarget?.name}» будет сгенерирован новый пароль. Старый перестанет работать
              сразу — сообщите организации новый.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={() => resetTarget && resetPassword(resetTarget)}>
              Сгенерировать
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить организацию?</AlertDialogTitle>
            <AlertDialogDescription>
              «{deleteTarget?.name}» потеряет доступ к кабинету. Действие необратимо.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteOrg(deleteTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}
