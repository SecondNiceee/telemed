"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AdminSetupForm } from "./admin-setup-form"
import { AdminLoginForm } from "./admin-login-form"
import { AdminOrganisations } from "./admin-organisations"
import type { AdminCategory, AdminOrganisation, AdminUser } from "./types"

interface AdminPanelProps {
  /** В базе нет ни одного пользователя — первым делом создаём администратора. */
  needsSetup: boolean
  initialAdmin: AdminUser | null
  initialOrganisations: AdminOrganisation[]
  initialCategories: AdminCategory[]
}

export function AdminPanel({
  needsSetup,
  initialAdmin,
  initialOrganisations,
  initialCategories,
}: AdminPanelProps) {
  const router = useRouter()
  const [admin, setAdmin] = useState<AdminUser | null>(initialAdmin)

  // После входа/настройки перезапрашиваем серверные данные — список организаций
  // приходит из RSC, поэтому просто обновляем маршрут.
  const handleAuthenticated = (user: AdminUser) => {
    setAdmin(user)
    router.refresh()
  }

  // Пока router.refresh() не принёс новые props, needsSetup ещё true —
  // но админ уже создан, поэтому форму настройки больше не показываем.
  if (needsSetup && !admin) {
    return (
      <AdminAuthShell
        badge="Первый запуск"
        title="Создайте администратора"
        description="В системе пока нет ни одного пользователя. Этот аккаунт получит полный доступ к панели управления."
      >
        <AdminSetupForm onSuccess={handleAuthenticated} />
      </AdminAuthShell>
    )
  }

  if (!admin) {
    return (
      <AdminAuthShell
        badge="Панель управления"
        title="Вход для администратора"
        description="Доступ разрешён только пользователям с ролью «Администратор»."
      >
        <AdminLoginForm onSuccess={handleAuthenticated} />
      </AdminAuthShell>
    )
  }

  return (
    <AdminOrganisations
      admin={admin}
      initialOrganisations={initialOrganisations}
      initialCategories={initialCategories}
      onSignedOut={() => {
        setAdmin(null)
        router.refresh()
      }}
    />
  )
}

/**
 * Общая обёртка для экранов входа и первичной настройки: слева фирменная
 * тёмная панель, справа форма.
 */
function AdminAuthShell({
  badge,
  title,
  description,
  children,
}: {
  badge: string
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <main className="min-h-screen flex flex-col lg:flex-row bg-background">
      <div className="lg:w-[38%] bg-[var(--surface-dark)] text-primary-foreground flex flex-col justify-between p-8 lg:p-12">
        <div>
          <p className="text-xl font-semibold tracking-tight">smartcardio</p>
          <p className="mt-1 text-sm text-primary-foreground/60">Панель администратора</p>
        </div>
        <div className="hidden lg:block max-w-xs">
          <p className="text-sm leading-relaxed text-primary-foreground/70">
            Здесь создаются организации и выдаются их доступы в кабинет{" "}
            <span className="font-mono text-[var(--teal-on-dark)]">/lk-org</span>.
          </p>
        </div>
        <p className="hidden lg:block text-xs text-primary-foreground/40">
          Расширенный доступ к данным — <span className="font-mono">/cms</span>
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm">
          <p className="text-xs font-medium uppercase tracking-widest text-[var(--teal)]">{badge}</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground text-balance">
            {title}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
            {description}
          </p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </main>
  )
}
