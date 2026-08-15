"use client"

import React, { useState, useEffect, useRef, useCallback, memo } from "react"
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
import { formatPhoneInput, normalizePhone } from "@/utils/phone"

type Tab = "login" | "register"

interface LoginModalProps {
  /** Необязателен: при управлении извне (open/onOpenChange) триггер не нужен */
  children?: React.ReactNode
  onSuccess?: () => void
  /** Controlled open state (optional) */
  open?: boolean
  /** Controlled open change handler (optional) */
  onOpenChange?: (open: boolean) => void
}

export interface RegisterValues {
  name: string
  email: string
  phone: string
  password: string
}

/**
 * Поля живут внутри форм, а не в LoginModal.
 *
 * Раньше каждое нажатие клавиши обновляло state модалки, и React перерисовывал
 * весь Dialog: портал, оверлей, focus-scope, обе вкладки и залипающий хэдер с
 * backdrop-blur под оверлеем. Отсюда и подлагивание при вводе. Теперь набор
 * текста ререндерит только саму форму, а оболочка Dialog остаётся нетронутой.
 */
const LoginForm = memo(function LoginForm({
  submitting,
  error,
  onSubmit,
}: {
  submitting: boolean
  error: string
  onSubmit: (email: string, password: string) => void
}) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(email, password)
      }}
      className="flex flex-col gap-4 pt-1"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="login-email">Электронная почта</Label>
        <Input
          id="login-email"
          type="email"
          placeholder="example@mail.ru"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </div>
      {error && <p className="text-sm text-destructive text-center">{error}</p>}
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
  )
})

const RegisterForm = memo(function RegisterForm({
  submitting,
  error,
  onSubmit,
}: {
  submitting: boolean
  error: string
  onSubmit: (values: RegisterValues) => void
}) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  /** Ошибки клиентской валидации — отдельно от серверных, которые приходят пропом */
  const [localError, setLocalError] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError("")

    if (!normalizePhone(phone)) {
      setLocalError("Введите номер телефона полностью")
      return
    }
    if (password !== confirm) {
      setLocalError("Пароли не совпадают")
      return
    }
    if (password.length < 8) {
      setLocalError("Пароль должен содержать минимум 8 символов")
      return
    }

    onSubmit({ name, email, phone, password })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
      <div className="flex flex-col gap-2">
        <Label htmlFor="reg-name">Имя</Label>
        <Input
          id="reg-name"
          type="text"
          placeholder="Иван Иванов"
          value={name}
          onChange={(e) => setName(e.target.value)}
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
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="reg-phone">Телефон</Label>
        <Input
          id="reg-phone"
          type="tel"
          inputMode="tel"
          placeholder="+7 (999) 123-45-67"
          value={phone}
          onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
          required
          autoComplete="tel"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="reg-password">Пароль</Label>
        <Input
          id="reg-password"
          type="password"
          placeholder="Минимум 8 символов"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
        />
      </div>
      {(localError || error) && (
        <p className="text-sm text-destructive text-center">{localError || error}</p>
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
  )
})

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

  const [loginError, setLoginError] = useState("")
  const [regError, setRegError] = useState("")
  const [regSuccess, setRegSuccess] = useState(false)
  const [regEmail, setRegEmail] = useState("")
  const [verifyChecking, setVerifyChecking] = useState(false)

  /** Ремонтирует формы, сбрасывая их внутренний state, при закрытии модалки */
  const [formKey, setFormKey] = useState(0)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  /** Креды для автологина после подтверждения почты — в ref, чтобы не ререндерить */
  const credentialsRef = useRef<{ email: string; password: string } | null>(null)
  /** submitting в ref — чтобы обработчики Dialog не пересоздавались на каждый submit */
  const submittingRef = useRef(false)

  const setSubmittingSafe = (value: boolean) => {
    submittingRef.current = value
    setSubmitting(value)
  }

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const handleReset = () => {
    setLoginError("")
    setRegError("")
    setRegSuccess(false)
    setRegEmail("")
    setSubmittingSafe(false)
    setVerifyChecking(false)
    setTab("login")
    credentialsRef.current = null
    setFormKey((key) => key + 1)
    stopPolling()
  }

  const handleOpenChange = (value: boolean) => {
    if (!value && submittingRef.current) return
    setOpen(value)
    if (!value) handleReset()
  }

  const finishSuccess = (user: { role?: string | null }) => {
    setOpen(false)
    handleReset()
    onSuccess?.()
    if (user.role === "user" || user.role === "admin") {
      // Use hard navigation to ensure server gets the new cookie
      window.location.href = "/lk"
    } else {
      router.refresh()
    }
  }

  const attemptAutoLogin = async () => {
    const credentials = credentialsRef.current
    if (!credentials) return
    try {
      // Call AuthApi directly — avoid store's loading state triggering re-renders
      const result = await AuthApi.login(credentials.email, credentials.password)
      stopPolling()
      // Only touch the store at the very end on success
      useUserStore.getState().setUser(result.user)
      finishSuccess(result.user)
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

    return stopPolling
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regSuccess])

  const handleLogin = useCallback(async (email: string, password: string) => {
    setLoginError("")
    setSubmittingSafe(true)
    try {
      // Call AuthApi directly — avoid store's loading state triggering re-renders
      const result = await AuthApi.login(email, password)
      // Only touch the store at the very end on success
      useUserStore.getState().setUser(result.user)
      finishSuccess(result.user)
    } catch (err) {
      setLoginError(getErrorMessage(err))
      setSubmittingSafe(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRegister = useCallback(async (values: RegisterValues) => {
    setRegError("")
    setSubmittingSafe(true)
    try {
      // Call AuthApi directly — no store mutation during registration
      await AuthApi.register(values)
      credentialsRef.current = { email: values.email, password: values.password }
      setRegEmail(values.email)
      setRegSuccess(true)
    } catch (err) {
      setRegError(getErrorMessage(err))
    } finally {
      setSubmittingSafe(false)
    }
  }, [])

  const handleConfirmCheck = async () => {
    setVerifyChecking(true)
    await attemptAutoLogin()
    setVerifyChecking(false)
  }

  /** Стабильные обработчики — иначе Radix Content ререндерится на каждое обновление */
  const guardDismiss = useCallback((e: { preventDefault: () => void }) => {
    if (submittingRef.current) e.preventDefault()
  }, [])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={guardDismiss}
        onInteractOutside={guardDismiss}
      >
        <DialogHeader>
          <div className="flex flex-col items-center gap-3 mb-1">
            <img
              src="/images/logo.jpg"
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
          <LoginForm
            key={`login-${formKey}`}
            submitting={submitting}
            error={loginError}
            onSubmit={handleLogin}
          />
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
              <RegisterForm
                key={`register-${formKey}`}
                submitting={submitting}
                error={regError}
                onSubmit={handleRegister}
              />
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
