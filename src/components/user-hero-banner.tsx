"use client"

import { Button } from "@/components/ui/button"
import { LogOut, MessageSquare } from "lucide-react"
import Link from "next/link"
import type { User } from "@/payload-types"
import { getInitials, getUpcomingAppointment } from "@/lib/utils/date"
import type { ApiAppointment } from "@/lib/api/types"
import { AppointmentCountdownBanner } from "@/components/appointment-countdown-banner"
import { formatPhone } from "@/utils/phone"
import { UnreadDot } from "@/components/unread-dot"

interface UserHeroBannerProps {
  user: User
  upcomingCount: number
  activeCount: number
  completedCount: number
  onLogout: () => void
  appointments?: ApiAppointment[]
  /** Есть непрочитанные хотя бы в одном чате — точка на кнопке «Сообщения». */
  hasUnreadMessages?: boolean
}

/**
 * Тёмная «шапка» кабинета в стилистике главной: surface-dark + точечный узор,
 * бирюзово-фиолетовый градиент на аватаре и статистике.
 */
export function UserHeroBanner({
  user,
  upcomingCount,
  activeCount,
  completedCount,
  onLogout,
  appointments = [],
  hasUnreadMessages = false,
}: UserHeroBannerProps) {
  const upcomingAppointment = getUpcomingAppointment(appointments)

  const stats = [
    { value: upcomingCount, label: "Предстоящих", accent: "primary" as const },
    { value: activeCount, label: "Активных", accent: "teal" as const },
    { value: completedCount, label: "Завершённых", accent: "muted" as const },
  ]

  return (
    <section className="relative overflow-hidden bg-surface-dark">
      {/* Точечный узор — тот же приём, что в секции «Кому подходит» на главной */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(oklch(1 0 0 / 0.07) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          maskImage: "radial-gradient(ellipse 70% 70% at 30% 0%, black 0%, transparent 80%)",
        }}
        aria-hidden="true"
      />
      {/* Мягкое бирюзово-фиолетовое свечение */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 80% at 88% 10%, oklch(0.6273 0.1067 201.3 / 0.20) 0%, oklch(0.4989 0.1406 299.8 / 0.16) 45%, transparent 75%)",
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            {/* Аватар: градиентная рамка бренда */}
            <div
              className="shrink-0 rounded-[1.15rem] p-[1.5px]"
              style={{
                background: "linear-gradient(140deg, var(--teal) 0%, var(--primary) 100%)",
              }}
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-dark">
                <span className="text-xl font-bold text-white">
                  {getInitials(user.name, user.email ?? undefined)}
                </span>
              </div>
            </div>

            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-on-dark">
                Личный кабинет
              </p>
              <h1 className="mt-1.5 text-balance text-2xl font-bold tracking-[-0.02em] text-white">
                {user.name || "Пользователь"}
              </h1>
              <p className="mt-1 truncate text-sm text-white/55">{user.email}</p>
              {user.phone && (
                <p className="text-sm text-white/40">{formatPhone(user.phone)}</p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              asChild
              size="sm"
            className="relative gap-2 rounded-full bg-white/10 px-4 text-white hover:bg-white/20"
          >
            <Link href="/lk/chat">
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Сообщения</span>
              {/* Обводка под тёмный баннер: ring-card дал бы светлый ореол. */}
              {hasUnreadMessages && (
                <UnreadDot className="bg-teal-on-dark ring-surface-dark" />
              )}
            </Link>
          </Button>
            <Button
              size="sm"
              onClick={onLogout}
              className="gap-2 rounded-full bg-transparent px-4 text-white/60 ring-1 ring-inset ring-white/15 hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Выйти</span>
            </Button>
          </div>
        </div>

        {/* Обратный отсчёт до консультации */}
        {upcomingAppointment && (
          <div className="mt-7">
            <AppointmentCountdownBanner
              appointment={upcomingAppointment}
              variant="hero"
              tone="onDark"
              chatHref={`/lk/chat?appointment=${upcomingAppointment.id}`}
            />
          </div>
        )}

        {/* Статистика: крупные цифры, тонкая градиентная черта сверху */}
        <div className="mt-7 grid grid-cols-3 gap-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="relative overflow-hidden rounded-xl bg-white/[0.06] px-4 py-3.5 ring-1 ring-inset ring-white/10"
            >
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-[2px]"
                style={{
                  background:
                    stat.accent === "primary"
                      ? "linear-gradient(to right, var(--primary), transparent)"
                      : stat.accent === "teal"
                        ? "linear-gradient(to right, var(--teal-on-dark), transparent)"
                        : "linear-gradient(to right, oklch(1 0 0 / 0.35), transparent)",
                }}
              />
              <p className="font-mono text-3xl font-bold tabular-nums leading-none text-white">
                {stat.value}
              </p>
              <p className="mt-1.5 text-xs text-white/50">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
