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
import { ApiError, getErrorMessage } from "@/lib/api/errors"
import { Loader2, MessageSquareLock } from "lucide-react"
import { resolveImageUrl } from "@/lib/utils/image"
import { formatPhone, formatPhoneInput, normalizePhone } from "@/utils/phone"

type Tab = "login" | "register"
type RegisterStep = "form" | "code"

const CODE_LENGTH = 4
const RESEND_SECONDS = 60

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
  const [loginPhone, setLoginPhone] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [loginError, setLoginError] = useState("")

  // Register state
  const [regName, setRegName] = useState("")
  const [regPhone, setRegPhone] = useState("")
  const [regEmail, setRegEmail] = useState("")
  const [regPassword, setRegPassword] = useState("")
  const [regConfirm, setRegConfirm] = useState("")
  const [regError, setRegError] = useState("")
  const [regStep, setRegStep] = useState<RegisterStep>("form")

  // SMS code state
  const [code, setCode] = useState("")
  const [codeError, setCodeError] = useState("")
  const [resendIn, setResendIn] = useState(0)
  const [resending, setResending] = useState(false)

  const codeInputRef = useRef<HTMLInputElement>(null)
  const autoSubmittedRef = useRef(false)

  const handleReset = () => {
    setLoginPhone("")
    setLoginPassword("")
    setLoginError("")
    setRegName("")
    setRegPhone("")
    setRegEmail("")
    setRegPassword("")
    setRegConfirm("")
    setRegError("")
    setRegStep("form")
    setCode("")
    setCodeError("")
    setResendIn(0)
    setResending(false)
    setSubmitting(false)
    setTab("login")
    autoSubmittedRef.current = false
  }

  const handleOpenChange = (value: boolean) => {
    if (!value && submitting) return
    setOpen(value)
    if (!value) handleReset()
  }

  // Таймер повторной отправки кода
  useEffect(() => {
    if (resendIn <= 0) return
    const timer = setInterval(() => {
      setResendIn((prev) => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [resendIn])

  // Автофокус на поле кода
  useEffect(() => {
    if (regStep === "code") codeInputRef.current?.focus()
  }, [regStep])

  const finishAuth = (user: Awaited<ReturnType<typeof AuthApi.login>>["user"]) => {
    useUserStore.getState().setUser(user)
    setOpen(false)
    handleReset()
    onSuccess?.()
    if (user.role === "user" || user.role === "admin") {
      // Hard navigation, чтобы сервер получил новую куку
      window.location.href = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/lk`
    } else {
      router.refresh()
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError("")

    if (!normalizePhone(loginPhone)) {
      setLoginError("Введите номер телефона полностью")
      return
    }

    setSubmitting(true)
    try {
      const result = await AuthApi.login(loginPhone, loginPassword)
      finishAuth(result.user)
    } catch (err) {
      setLoginError(getErrorMessage(err))
      setSubmitting(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegError("")

    if (!normalizePhone(regPhone)) {
      setRegError("Введите номер телефона полностью")
      return
    }
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
      const result = await AuthApi.register({
        name: regName,
        phone: regPhone,
        password: regPassword,
        email: regEmail || undefined,
      })
      setCode("")
      setCodeError("")
      autoSubmittedRef.current = false
      setResendIn(result.resendAfter ?? RESEND_SECONDS)
      setRegStep("code")
    } catch (err) {
      // Код уже был отправлен недавно — сразу показываем шаг ввода кода с таймером
      if (err instanceof ApiError && err.status === 429) {
        const retryAfter = (err.data as { retryAfter?: number } | undefined)?.retryAfter
        setCode("")
        setCodeError(getErrorMessage(err))
        autoSubmittedRef.current = false
        setResendIn(retryAfter ?? RESEND_SECONDS)
        setRegStep("code")
      } else {
        setRegError(getErrorMessage(err))
      }
    } finally {
      setSubmitting(false)
    }
  }

  const submitCode = async (value: string) => {
    setCodeError("")
    setSubmitting(true)
    try {
      await AuthApi.verifyPhone(regPhone, value)
      const result = await AuthApi.login(regPhone, regPassword)
      finishAuth(result.user)
    } catch (err) {
      setCodeError(getErrorMessage(err))
      setCode("")
      autoSubmittedRef.current = false
      setSubmitting(false)
      codeInputRef.current?.focus()
    }
  }

  const handleCodeChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, CODE_LENGTH)
    setCode(digits)
    setCodeError("")

    if (digits.length === CODE_LENGTH && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true
      void submitCode(digits)
    }
  }

  const handleResend = async () => {
    setCodeError("")
    setResending(true)
    try {
      const result = await AuthApi.resendCode(regPhone)
      setResendIn(result.resendAfter ?? RESEND_SECONDS)
      setCode("")
      autoSubmittedRef.current = false
      codeInputRef.current?.focus()
    } catch (err) {
      setCodeError(getErrorMessage(err))
    } finally {
      setResending(false)
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
          <div className="flex flex-col items-center gap-3 mb-1">
            <img
              src={resolveImageUrl("/images/logo.jpg")}
              alt="SmartCardio"
              width={48}
              height={48}
              className="w-12 h-12 rounded-lg object-contain"
            />
            <DialogTitle className="text-xl text-center">
              {tab === "login"
                ? "Вход в аккаунт"
                : regStep === "code"
                  ? "Подтверждение номера"
                  : "Регистрация"}
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Tabs */}
        {regStep === "form" && (
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
        )}

        {tab === "login" && (
          <form onSubmit={handleLogin} className="flex flex-col gap-4 pt-1">
            <div className="flex flex-col gap-2">
              <Label htmlFor="login-phone">Телефон</Label>
              <Input
                id="login-phone"
                type="tel"
                inputMode="tel"
                placeholder="+7 (999) 123-45-67"
                value={loginPhone}
                onChange={(e) => setLoginPhone(formatPhoneInput(e.target.value))}
                required
                autoComplete="tel"
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

        {tab === "register" && regStep === "code" && (
          <div className="flex flex-col items-center gap-4 py-2 text-center">
            <MessageSquareLock className="w-11 h-11 text-primary" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              Код из SMS отправлен на{" "}
              <span className="font-medium text-foreground">{formatPhone(regPhone)}</span>
            </p>
            <div className="flex w-full flex-col gap-2">
              <Label htmlFor="reg-code" className="sr-only">
                Код из SMS
              </Label>
              <Input
                id="reg-code"
                ref={codeInputRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={CODE_LENGTH}
                placeholder="0000"
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                disabled={submitting}
                className="text-center text-2xl tracking-[0.6em] font-mono h-14"
              />
            </div>
            {codeError && <p className="text-sm text-destructive">{codeError}</p>}
            {submitting && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Проверяем код...
              </p>
            )}
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={handleResend}
              disabled={resendIn > 0 || resending || submitting}
            >
              {resending ? (
                <>
                  <Loader2 className="animate-spin" />
                  <span>Отправляем...</span>
                </>
              ) : resendIn > 0 ? (
                `Отправить код повторно через ${resendIn} сек.`
              ) : (
                "Отправить код повторно"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                setRegStep("form")
                setCode("")
                setCodeError("")
                autoSubmittedRef.current = false
              }}
              disabled={submitting}
            >
              Изменить номер
            </Button>
          </div>
        )}

        {tab === "register" && regStep === "form" && (
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
              <Label htmlFor="reg-phone">Телефон</Label>
              <Input
                id="reg-phone"
                type="tel"
                inputMode="tel"
                placeholder="+7 (999) 123-45-67"
                value={regPhone}
                onChange={(e) => setRegPhone(formatPhoneInput(e.target.value))}
                required
                autoComplete="tel"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="reg-email">
                Электронная почта{" "}
                <span className="text-muted-foreground font-normal">(необязательно)</span>
              </Label>
              <Input
                id="reg-email"
                type="email"
                placeholder="example@mail.ru"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
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
                  <span>Отправляем код...</span>
                </>
              ) : (
                "Зарегистрироваться"
              )}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
