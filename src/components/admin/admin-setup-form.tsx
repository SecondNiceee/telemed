"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatPhoneInput, normalizePhone } from "@/utils/phone"
import type { AdminUser } from "./types"

/** Форма первого администратора — показывается только на пустой базе. */
export function AdminSetupForm({ onSuccess }: { onSuccess: (user: AdminUser) => void }) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError("Пароли не совпадают")
      return
    }
    if (password.length < 8) {
      setError("Пароль минимум 8 символов")
      return
    }
    if (!normalizePhone(phone)) {
      setError("Введите телефон в формате +7 (999) 123-45-67")
      return
    }

    setPending(true)
    try {
      const res = await fetch("/api/admin/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, email, phone: normalizePhone(phone), password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || "Не удалось создать администратора")
      onSuccess(data.user as AdminUser)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать администратора")
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="setup-name">Имя</Label>
        <Input id="setup-name" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="setup-email">Email</Label>
        <Input
          id="setup-email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="setup-phone">Телефон</Label>
        <Input
          id="setup-phone"
          inputMode="tel"
          placeholder="+7 (999) 123-45-67"
          required
          value={phone}
          onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="setup-password">Пароль</Label>
        <Input
          id="setup-password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="setup-confirm">Повторите пароль</Label>
        <Input
          id="setup-confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="mt-2">
        {pending ? "Создаём…" : "Создать администратора"}
      </Button>
    </form>
  )
}
