"use client"

import React, { useState, useEffect, useRef } from "react"
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
import { useUserStore } from "@/stores/user-store"
import { AuthApi } from "@/lib/api/auth"
import { getErrorMessage } from "@/lib/api/errors"
import { Loader2, MailCheck } from "lucide-react"
import { resolveImageUrl } from "@/lib/utils/image"

type Tab = "login" | "register"

interface LoginModalProps {
  children: React.ReactNode
  onSuccess?: () => void
  /** Controlled open state (optional) */
  open?: boolean
  /** Controlled open change handler (optional) */
  onOpenChange?: (open: boolean) => void
}

export function LoginModal({ children, onSuccess, open: controlledOpen, onOpenChange: controlledOnOpenChange }: LoginModalProps) {
  const router = useRouter()
  const [internalOpen, setInternalOpen] = useState(false)
  const [tab, setTab] = useState<Tab>("login")

  // Support both controlled and uncontrolled usage
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = (value: boolean) => {
    setInternalOpen(value)
    controlledOnOpenChange?.(value)
  }
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
  const [verifyChecking, setVerifyChecking] = useState(false)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
    setVerifyChecking(false)
    setTab("login")
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const handleOpenChange = (value: boolean) => {
    if (!value && submitting) return
    setOpen(value)
    if (!value) handleReset()
  }

  const attemptAutoLogin = async () => {
    if (!regEmail || !regPassword) return
    try {
      // Call AuthApi directly — avoid store's loading state triggering re-renders
      const result = await AuthApi.login(regEmail, regPassword)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      // Only touch the store at the very end on success
      useUserStore.getState().setUser(result.user)
      setOpen(false)
      handleReset()
      onSuccess?.()
      if (result.user.role === "user" || result.user.role === "admin") {
        router.push("/lk")
      } else {
        router.refresh()
      }
    } catch {
      // Not verified yet — silently ignore, keep polling
    }
  }

  // Start polling when regSuccess becomes true
  useEffect(() => {
    if (!regSuccess) return

    attemptAutoLogin()

    intervalRef.current = setInterval(() => {
      attemptAutoLogin()
    }, 7000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regSuccess])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError("")
    setSubmitting(true)
    try {
      // Call AuthApi directly — avoid store's loading state triggering re-renders
      const result = await AuthApi.login(loginEmail, loginPassword)
      // Only touch the store at the very end on success
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
      setLoginError(getErrorMessage(err))
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
      // Call AuthApi directly — no store mutation during registration
      await AuthApi.register({ name: regName, email: regEmail, password: regPassword })
      setRegSuccess(true)
    } catch (err) {
      setRegError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleConfirmCheck = async () => {
    setVerifyChecking(true)
    await attemptAutoLogin()
    setVerifyChecking(false)
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
          <div className="flex flex-col items-center gap-3 mb-1">
            <img
              src={resolveImageUrl("/images/logo.jpg")}
              alt="SmartCardio"
              width={48}
              height={48}
              className="w-12 h-12 rounded-lg object-contain"
            />
            <DialogTitle className="text-xl text-center">
              {tab === "login" ? "Вход в аккаунт" : "Регистрация"}
            </DialogTitle>
          </div>
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
                <p className="text-xs text-muted-foreground">
                  После подтверждения вы будете автоматически перенаправлены...
                </p>
                <Button
                  className="w-full"
                  onClick={handleConfirmCheck}
                  disabled={verifyChecking}
                >
                  {verifyChecking ? (
                    <>
                      <Loader2 className="animate-spin" />
                      <span>Проверяем...</span>
                    </>
                  ) : (
                    "Я подтвердил почту"
                  )}
                </Button>
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
