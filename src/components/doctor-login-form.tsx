"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useDoctorStore } from "@/stores/doctor-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Stethoscope, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { resolveImageUrl } from "@/lib/utils/image"

export function DoctorLoginForm() {
  const router = useRouter()
  const { login, loading } = useDoctorStore()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    try {
      await login(email, password)
      router.push("/lk-med")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при входе")
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/30">
      {/* Back link */}
      <div className="p-4 sm:p-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          На главную
        </Link>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-4 pb-12">
        <div className="w-full max-w-md">
          {/* Logo & Title */}
          <div className="flex flex-col items-center mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-14 h-14 rounded-2xl overflow-hidden ring-2 ring-border/60 shadow-lg shadow-primary/10">
                <img
                  src={resolveImageUrl("/images/logo.jpg")}
                  alt="Smartcardio"
                  width={56}
                  height={56}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex flex-col leading-none gap-1">
                <span className="text-2xl font-bold tracking-tight text-foreground">
                  Smartcardio
                </span>
                <span className="text-xs font-semibold tracking-widest uppercase text-primary/70">
                  Телемедицина
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-primary mb-2">
              <Stethoscope className="w-5 h-5" />
              <span className="text-sm font-medium uppercase tracking-wide">
                Портал для врачей
              </span>
            </div>
            <h1 className="text-2xl font-bold text-foreground text-center">
              Вход в личный кабинет
            </h1>
            <p className="text-muted-foreground text-center mt-2 text-sm max-w-xs">
              Введите данные вашего аккаунта для доступа к панели управления консультациями
            </p>
          </div>

          {/* Login Card */}
          <div className="rounded-2xl border border-border bg-card shadow-xl shadow-black/5 p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="doctor-login-email" className="text-foreground font-medium">
                  Электронная почта
                </Label>
                <Input
                  id="doctor-login-email"
                  type="email"
                  placeholder="doctor@clinic.ru"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-11"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="doctor-login-password" className="text-foreground font-medium">
                  Пароль
                </Label>
                <Input
                  id="doctor-login-password"
                  type="password"
                  placeholder="Введите пароль"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-11"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3">
                  <p className="text-sm text-destructive text-center">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 text-base font-medium mt-1"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Вход...</span>
                  </>
                ) : (
                  "Войти"
                )}
              </Button>
            </form>
          </div>

          {/* Footer note */}
          <p className="text-center text-xs text-muted-foreground mt-6">
            Если у вас нет аккаунта врача, обратитесь к администратору вашей организации
          </p>
        </div>
      </div>
    </div>
  )
}
