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
import { cn } from "@/lib/utils"
import { AuthApi } from "@/lib/api/auth"
import { Loader2 } from "lucide-react"

type LoginMode = "user" | "doctor"

interface LoginModalProps {
  children: React.ReactNode
  onSuccess?: () => void
}

export function LoginModal({ children, onSuccess }: LoginModalProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<LoginMode>("user")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleReset = () => {
    setEmail("")
    setPassword("")
    setError("")
    setLoading(false)
  }

  const handleOpenChange = (value: boolean) => {
    setOpen(value)
    if (!value) {
      handleReset()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const result = await AuthApi.login(email, password)
      const user = result.user

      if (mode === "doctor") {
        if (user.role !== "doctor" && user.role !== "admin") {
          setError("Этот аккаунт не является аккаунтом врача")
          setLoading(false)
          return
        }
        setOpen(false)
        handleReset()
        onSuccess?.()
        router.push("/doctor-dashboard")
      } else {
        if (user.role === "doctor") {
          setError("Этот аккаунт является аккаунтом врача. Переключитесь в режим \"Для врачей\"")
          setLoading(false)
          return
        }
        setOpen(false)
        handleReset()
        onSuccess?.()
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при входе")
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl text-center">Вход в аккаунт</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-6 pt-2">
          {/* Mode toggle */}
          <div className="flex rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => {
                setMode("user")
                setError("")
              }}
              className={cn(
                "flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all",
                mode === "user"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Для пользователей
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("doctor")
                setError("")
              }}
              className={cn(
                "flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all",
                mode === "doctor"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Для врачей
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="animate-spin" />
                  <span>Вход...</span>
                </>
              ) : (
                "Войти"
              )}
            </Button>
          </form>

          {mode === "doctor" && (
            <p className="text-xs text-muted-foreground text-center">
              Учетная запись врача создается администратором клиники
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
