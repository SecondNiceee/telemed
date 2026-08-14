"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { AdminOrganisation, IssuedCredentials } from "./types"

interface AdminCreateOrgDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (org: AdminOrganisation, credentials: IssuedCredentials) => void
}

export function AdminCreateOrgDialog({ open, onOpenChange, onCreated }: AdminCreateOrgDialogProps) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  // Пустое поле = пароль сгенерирует сервер. Это основной сценарий.
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const reset = () => {
    setName("")
    setEmail("")
    setPassword("")
    setError(null)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      const res = await fetch("/api/admin/organisations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, email, password: password || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || "Не удалось создать организацию")

      onCreated(data.organisation as AdminOrganisation, {
        organisationName: data.organisation.name,
        email: data.credentials.email,
        password: data.credentials.password,
      })
      reset()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать организацию")
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новая организация</DialogTitle>
          <DialogDescription>
            Email станет логином для входа в кабинет организации.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="org-name">Название</Label>
            <Input
              id="org-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Клиника «Здоровье»"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="org-email">Email (логин)</Label>
            <Input
              id="org-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="clinic@example.com"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="org-password">Пароль</Label>
            <Input
              id="org-password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Оставьте пустым — сгенерируем"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Пароль будет показан один раз после создания. Потом его можно только сбросить.
            </p>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Создаём…" : "Создать"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
