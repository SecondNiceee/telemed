"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Building2,
  Database,
  ExternalLink,
  KeyRound,
  LogOut,
  Plus,
  Search,
  Stethoscope,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { AdminSeedDialog } from "./admin-seed-dialog"
import type { AdminOrganisation, AdminUser, IssuedCredentials } from "./types"

/** Дата создания организации в коротком русском формате. */
function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
}

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
  const router = useRouter()
  const [organisations, setOrganisations] = useState(initialOrganisations)
  const [query, setQuery] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [seedOpen, setSeedOpen] = useState(false)
  const [credentials, setCredentials] = useState<IssuedCredentials | null>(null)
  const [resetTarget, setResetTarget] = useState<AdminOrganisation | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminOrganisation | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Список приходит из RSC: после router.refresh() подтягиваем свежие данные,
  // иначе локальный state навсегда останется со снимком первого рендера.
  useEffect(() => {
    setOrganisations(initialOrganisations)
  }, [initialOrganisations])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return organisations
    return organisations.filter(
      (org) => org.name.toLowerCase().includes(q) || org.email.toLowerCase().includes(q),
    )
  }, [organisations, query])

  // Категории и врачи приходят в другие экраны из RSC — после сидирования
  // просим Next перезапросить серверные данные.
  const onDataSeeded = () => {
    router.refresh()
  }

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
              asChild
              variant="ghost"
              size="sm"
              className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10"
            >
              <a href="/cms" target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" />
                <span className="hidden sm:inline">Полная CMS</span>
              </a>
            </Button>
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
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/admin/categories">
                <Stethoscope className="size-4" />
                Категории
              </Link>
            </Button>
            <Button variant="outline" onClick={() => setSeedOpen(true)}>
              <Database className="size-4" />
              Создать тестовые данные
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Создать организацию
            </Button>
          </div>
        </div>

        {organisations.length > 1 && (
          <div className="mt-6 relative max-w-sm">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по названию или email"
              aria-label="Поиск организаций"
              className="pl-9"
            />
          </div>
        )}

        <div className="mt-8">
          {organisations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-6 py-16 flex flex-col items-center text-center gap-3">
              <Building2 className="size-8 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground max-w-xs text-pretty">
                Создайте организацию, чтобы выдать ей доступ в кабинет и добавить врачей.
              </p>
            </div>
          ) : visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ничего не найдено по запросу «{query}»</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {visible.map((org) => (
                <li
                  key={org.id}
                  className="rounded-xl border border-border bg-card px-5 py-4 flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-card-foreground truncate">{org.name}</p>
                    <p className="text-sm text-muted-foreground font-mono truncate">{org.email}</p>
                    {org.createdAt && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Создана {formatDate(org.createdAt)}
                      </p>
                    )}
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

      <AdminSeedDialog
        open={seedOpen}
        onOpenChange={setSeedOpen}
        organisations={organisations}
        onSeeded={onDataSeeded}
      />

      <AdminCredentialsDialog
        credentials={credentials}
        onClose={() => setCredentials(null)}
      />

      <AlertDialog open={Boolean(resetTarget)} onOpenChange={(open) => !open && setResetTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Сбросить пароль организации?</AlertDialogTitle>
            <AlertDialogDescription>
              Для {resetTarget?.name} будет сгенерирован новый пароль. Старый перестанет работать
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
              {deleteTarget?.name} потеряет доступ к кабинету. Действие необратимо.
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
