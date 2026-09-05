"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useOrgStore } from "@/stores/org-store"
import { LkOrgContent } from "@/components/lk-org-content"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import type { ApiDoctor } from "@/lib/api/types"
import type { OrgStats } from "@/app/(frontend)/lk-org/page"

interface LkOrgGateProps {
  initialOrg: { id: number; name?: string; email: string; supportPhone?: string | null } | null
  initialDoctors?: ApiDoctor[]
  initialStats?: OrgStats
  children?: React.ReactNode
}

export function LkOrgGate({ initialOrg, initialDoctors, initialStats, children }: LkOrgGateProps) {
  const router = useRouter()
  const { org: storeOrg, login, loading } = useOrgStore()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isRefreshing, startRefresh] = useTransition()

  // Кабинет рисуем только по данным сервера. Стор после login() знает об
  // организации раньше, чем сервер успел перерендерить страницу с cookie, и
  // если довериться ему, LkOrgContent смонтируется с пустыми initialDoctors
  // (они были посчитаны для неавторизованного запроса) и больше их не
  // обновит - список врачей появится только после F5. Поэтому storeOrg здесь
  // означает лишь «логин прошёл, ждём refresh», а не «можно показывать».
  const org = initialOrg
  const awaitingServer = !initialOrg && !!storeOrg

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    // Весь вход - одна async-transition: isRefreshing становится true до
    // запроса и остаётся true, пока refresh не дорисует страницу с данными
    // сервера. Если бы login() шёл снаружи, стор успел бы выставить org до
    // startRefresh, и на один кадр показалась бы ветка ошибки ниже.
    startRefresh(async () => {
      try {
        await login(email, password)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка при входе")
      }
    })
  }

  if (awaitingServer) {
    // refresh завершился, а сервер организацию не увидел: cookie не дошла
    // (например, заблокирована браузером). Показать это честно лучше, чем
    // крутить лоадер бесконечно.
    if (!isRefreshing) {
      return (
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="w-full max-w-sm mx-auto px-4 text-center flex flex-col gap-3">
            <p className="text-sm text-destructive">
              Не удалось подтвердить вход. Проверьте, что браузер разрешает cookie для этого
              сайта, и попробуйте обновить страницу.
            </p>
            <Button variant="outline" onClick={() => router.refresh()}>
              Обновить
            </Button>
          </div>
        </div>
      )
    }

    return (
      <div
        className="flex-1 flex items-center justify-center py-20"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          <span>Загружаем кабинет…</span>
        </div>
      </div>
    )
  }

  // Not logged in as organisation -- show login form
  if (!org) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="w-full max-w-sm mx-auto px-4">
          <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
            <div className="flex flex-col items-center gap-3 mb-6">
              <img
                src="/images/logo.jpg"
                alt="SmartCardio"
                width={48}
                height={48}
                className="w-12 h-12 rounded-lg object-contain"
              />
              <div className="text-center">
                <h1 className="text-xl font-semibold text-foreground">
                  Вход для организаций
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Введите логин и пароль вашей организации
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="org-login-email">Электронная почта</Label>
                <Input
                  id="org-login-email"
                  type="email"
                  placeholder="org@company.ru"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="org-login-password">Пароль</Label>
                <Input
                  id="org-login-password"
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

              <Button type="submit" className="w-full" disabled={loading || isRefreshing}>
                {loading || isRefreshing ? (
                  <>
                    <Loader2 className="animate-spin" />
                    <span>Вход...</span>
                  </>
                ) : (
                  "Войти"
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // Logged in -- show children or organisation dashboard
  if (children) {
    return <>{children}</>
  }

  return (
    <LkOrgContent
      userName={org.name || org.email}
      initialDoctors={initialDoctors ?? []}
      orgId={org.id}
      stats={initialStats ?? { total: 0, upcoming: 0, past: 0, cancelled: 0 }}
    />
  )
}
