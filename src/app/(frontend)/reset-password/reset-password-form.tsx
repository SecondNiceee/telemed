"use client"

import React, { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AuthApi } from "@/lib/api/auth"
import { ApiError, getErrorMessage } from "@/lib/api/errors"
import { useUserStore } from "@/stores/user-store"
import { CheckCircle2, Loader2, XCircle } from "lucide-react"

type Status = "form" | "expired" | "unverified"

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<Status>("form")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (password !== confirm) {
      setError("Пароли не совпадают")
      return
    }
    if (password.length < 8) {
      setError("Пароль должен содержать минимум 8 символов")
      return
    }

    setSubmitting(true)
    try {
      const result = await AuthApi.resetPassword(token, password)

      if (result.user?._verified === false) {
        // Пароль сменили, но входить нельзя — email всё ещё не подтверждён
        setStatus("unverified")
        return
      }

      // Payload вернул Set-Cookie — пользователь уже авторизован.
      useUserStore.getState().setUser(result.user)
      // Hard navigation, чтобы сервер увидел новую cookie
      window.location.href = "/lk"
    } catch (err) {
      // 403 — токен просрочен или уже использован
      if (err instanceof ApiError && err.status === 403) {
        setStatus("expired")
        return
      }
      setError(getErrorMessage(err))
      setSubmitting(false)
    }
  }

  if (status === "expired") {
    return (
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 text-destructive">
          <XCircle className="w-8 h-8" strokeWidth={1.75} />
        </div>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Ссылка недействительна
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Ссылка устарела или уже была использована. Запросите новое письмо через «Забыли пароль?»
            на главной странице.
          </p>
        </div>
        <div className="w-full border-t border-border" />
        <Button asChild className="w-full">
          <Link href="/">На главную</Link>
        </Button>
      </div>
    )
  }

  if (status === "unverified") {
    return (
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary">
          <CheckCircle2 className="w-8 h-8" strokeWidth={1.75} />
        </div>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Пароль обновлён</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Новый пароль сохранён, но ваш email пока не подтверждён. Перейдите по ссылке из письма о
            регистрации, чтобы войти в личный кабинет.
          </p>
        </div>
        <div className="w-full border-t border-border" />
        <Button asChild variant="outline" className="w-full">
          <Link href="/">На главную</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-1.5 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Новый пароль</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Придумайте новый пароль для входа в аккаунт.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-password">Новый пароль</Label>
          <Input
            id="new-password"
            type="password"
            placeholder="Минимум 8 символов"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm-password">Повторите пароль</Label>
          <Input
            id="confirm-password"
            type="password"
            placeholder="Повторите пароль"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
          />
        </div>
        {error && <p className="text-sm text-destructive text-center">{error}</p>}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="animate-spin" />
              <span>Сохраняем...</span>
            </>
          ) : (
            "Сохранить пароль"
          )}
        </Button>
        <Button asChild variant="ghost" className="w-full" disabled={submitting}>
          <Link href="/">Отмена</Link>
        </Button>
      </form>
    </div>
  )
}
