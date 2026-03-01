"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { AuthApi } from "@/lib/api/auth"
import { useUserStore } from "@/stores/user-store"
import { Loader2, MailCheck } from "lucide-react"

type Tab = "login" | "register"

interface LoginModalProps {
  children: React.ReactNode
  onSuccess?: () => void
}

export function LoginModal({ children, onSuccess }: LoginModalProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>("login")
  const [submitting, setSubmitting] = useState(false)

  // Login state
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [loginError, setLoginError] = useState("")

  // Register state
  const [regName, setRegName] = useState("")
  const [regEmail, setRegEmail] = useState("")
  const [regPassword, setRegPassword] = useState("")
  const [regConfirm, setRegConfirm] = useState("")
  const [regError, setRegError] = useState("")
  const [regSuccess, setRegSuccess] = useState(false)

  const handleReset = () => {
    setLoginEmail("")
    setLoginPassword("")
    setLoginError("")
    setRegName("")
    setRegEmail("")
    setRegPassword("")
    setRegConfirm("")
    setRegError("")
    setRegSuccess(false)
    setSubmitting(false)
    setTab("login")
  }

  const handleOpenChange = (value: boolean) => {
    if (!value && submitting) return
    setOpen(value)
    if (!value) handleReset()
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError("")
    setSubmitting(true)
    try {
      const result = await AuthApi.login(loginEmail, loginPassword)
      // Update zustand store with the logged-in user
      useUserStore.getState().setUser(result.user)
      setOpen(false)
      handleReset()
      onSuccess?.()
      if (result.user.role === "user" || result.user.role === "admin") {
        router.push("/lk")
      } else {
        router.refresh()
      }
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Ошибка при входе")
      setSubmitting(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegError("")

    if (regPassword !== regConfirm) {
      setRegError("Пароли не совпадают")
      return
    }
    if (regPassword.length < 8) {
      setRegError("Пароль должен содержать минимум 8 символов")
      return
    }

    setSubmitting(true)
    try {
      await AuthApi.register({ name: regName, email: regEmail, password: regPassword })
      setRegSuccess(true)
    } catch (err) {
      setRegError(err instanceof Error ? err.message : "Ошибка при регистрации")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent
          className="sm:max-w-md"
          onPointerDownOutside={(e) => {
            if (submitting) e.preventDefault()
          }}
          onInteractOutside={(e) => {
            if (submitting) e.preventDefault()
          }}
        >
        <DialogHeader>
          <DialogTitle className="text-xl text-center">
            {tab === "login" ? "Вход в аккаунт" : "Регистрация"}
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex rounded-lg overflow-hidden border border-border text-sm font-medium">
          <button
            type="button"
            onClick={() => { setTab("login"); setLoginError("") }}
            className={`flex-1 py-2 transition-colors ${
              tab === "login"
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            Войти
          </button>
          <button
            type="button"
            onClick={() => { setTab("register"); setRegError("") }}
            className={`flex-1 py-2 transition-colors ${
              tab === "register"
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            Зарегистрироваться
          </button>
        </div>

        {tab === "login" && (
          <form onSubmit={handleLogin} className="flex flex-col gap-4 pt-1">
            <div className="flex flex-col gap-2">
              <Label htmlFor="login-email">Электронная почта</Label>
              <Input
                id="login-email"
                type="email"
                placeholder="example@mail.ru"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="login-password">Пароль</Label>
              <Input
                id="login-password"
                type="password"
                placeholder="Введите пароль"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            {loginError && (
              <p className="text-sm text-destructive text-center">{loginError}</p>
            )}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" />
                  <span>Вход...</span>
                </>
              ) : (
                "Войти"
              )}
            </Button>
          </form>
        )}

        {tab === "register" && (
          <>
            {regSuccess ? (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <MailCheck className="w-12 h-12 text-primary" />
                <p className="font-medium text-lg">Письмо отправлено!</p>
                <p className="text-sm text-muted-foreground">
                  Мы отправили ссылку для подтверждения на{" "}
                  <span className="font-medium text-foreground">{regEmail}</span>.
                  Перейдите по ней, чтобы завершить регистрацию.
                </p>
                <Button variant="outline" className="w-full" onClick={() => handleOpenChange(false)}>
                  Закрыть
                </Button>
              </div>
            ) : (
              <form onSubmit={handleRegister} className="flex flex-col gap-4 pt-1">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="reg-name">Имя</Label>
                  <Input
                    id="reg-name"
                    type="text"
                    placeholder="Иван Иванов"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    required
                    autoComplete="name"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="reg-email">Электронная почта</Label>
                  <Input
                    id="reg-email"
                    type="email"
                    placeholder="example@mail.ru"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="reg-password">Пароль</Label>
                  <Input
                    id="reg-password"
                    type="password"
                    placeholder="Минимум 8 символов"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="reg-confirm">Повторите пароль</Label>
                  <Input
                    id="reg-confirm"
                    type="password"
                    placeholder="Повторите пароль"
                    value={regConfirm}
                    onChange={(e) => setRegConfirm(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>
                {regError && (
                  <p className="text-sm text-destructive text-center">{regError}</p>
                )}
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="animate-spin" />
                      <span>Регистрация...</span>
                    </>
                  ) : (
                    "Зарегистрироваться"
                  )}
                </Button>
              </form>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
