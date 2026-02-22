"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useOrgStore } from "@/stores/org-store"
import { LkOrgContent } from "@/components/lk-org-content"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import type { ApiDoctor } from "@/lib/api/types"

interface LkOrgGateProps {
  initialOrg: { id: number; name?: string; email: string } | null
  initialDoctors: ApiDoctor[]
}

export function LkOrgGate({ initialOrg, initialDoctors }: LkOrgGateProps) {
  const router = useRouter()
  const { org: storeOrg, login, loading } = useOrgStore()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  const org = storeOrg || initialOrg

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    try {
      await login(email, password)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при входе")
    }
  }

  // Not logged in as organisation -- show login form
  if (!org) {
    return (
      <div className="flex-1 flex items-center justify-center py-12 sm:py-20">
        <div className="w-full max-w-sm mx-auto px-4">
          <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
            <div className="text-center mb-6">
              <h1 className="text-xl font-semibold text-foreground">
                Вход для организаций
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Введите логин и пароль вашей организации
              </p>
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
          </div>
        </div>
      </div>
    )
  }

  // Logged in -- show organisation dashboard
  return (
    <LkOrgContent
      userName={org.name || org.email}
      initialDoctors={initialDoctors}
      orgId={org.id}
    />
  )
}
