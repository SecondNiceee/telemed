"use client"

import { useEffect, useState } from "react"
import { useUserStore } from "@/stores/user-store"
import { useUserAppointmentStore } from "@/stores/user-appointments-store"
import Link from "next/link"
import type { ApiAppointment } from "@/lib/api/types"
import { Button } from "@/components/ui/button"
import { User } from "@/payload-types"
import { UserHeroBanner } from "@/components/user-hero-banner"
import { UserAppointmentCard } from "@/components/user-appointment-card"
import { FeedbackPrompt } from "@/components/feedback-prompt"
import { ConsultationGuide } from "@/components/consultation-guide"
import { useUnreadMessages } from "@/hooks/use-unread-messages"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface LkContentProps {
  user: User | null
  appointments: ApiAppointment[]
  /** Снимок непрочитанных из БД на момент рендера страницы: id записи → количество. */
  initialUnreadCounts: Record<number, number>
}

type FilterType = 'all' | 'upcoming' | 'completed' | 'cancelled'

const FILTER_STORAGE_KEY = 'patient-appointments-filter'
const FILTERS: { id: FilterType; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'upcoming', label: 'Предстоящие' },
  { id: 'completed', label: 'Завершённые' },
  { id: 'cancelled', label: 'Отменённые' },
]

/** Тексты пустого состояния для каждого фильтра */
const EMPTY_STATE: Record<FilterType, { title: string; hint: string }> = {
  all: {
    title: 'У вас пока нет записей',
    hint: 'Выберите специалиста и удобное время — консультация пройдёт по видео.',
  },
  upcoming: {
    title: 'Нет предстоящих записей',
    hint: 'Запишитесь на приём, и здесь появится обратный отсчёт до консультации.',
  },
  completed: {
    title: 'Нет завершённых записей',
    hint: 'После консультации здесь останутся заключения и рекомендации врача.',
  },
  cancelled: {
    title: 'Нет отменённых консультаций',
    hint: 'Здесь появятся консультации, которые врач отметил как несостоявшиеся.',
  },
}

export function LkContent({
  user,
  appointments: serverAppointments,
  initialUnreadCounts,
}: LkContentProps) {
  const { loading: userLoading, setUser, user: storeUser, fetched: userFetched, logout } = useUserStore()
  const { appointments, setAppointments, loading: apptLoading, fetched: apptFetched } = useUserAppointmentStore()
  const [filter, setFilter] = useState<FilterType>('all')
  const { hasUnread, hasAnyUnread } = useUnreadMessages(initialUnreadCounts)

  useEffect(() => {
    const saved = window.localStorage.getItem(FILTER_STORAGE_KEY)
    if (FILTERS.some(({ id }) => id === saved)) setFilter(saved as FilterType)
  }, [])

  const changeFilter = (value: FilterType) => {
    setFilter(value)
    window.localStorage.setItem(FILTER_STORAGE_KEY, value)
  }

  // Sync user to store
  useEffect(() => {
    if (!storeUser && user) {
      setUser(user)
    }
  }, [storeUser, user, setUser])

  // Always sync server-loaded appointments to store on initial load
  // This ensures fresh SSR data is used even if store was populated by booking.
  // Записи с сервера уже отфильтрованы по user.id — помечаем владельца, чтобы
  // остальные экраны не приняли их за данные другого аккаунта.
  useEffect(() => {
    if (serverAppointments.length > 0) {
      setAppointments(serverAppointments, user?.id ?? null)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!userFetched || userLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!user) return null

  const isLoading = apptLoading && !apptFetched
  
  // Filter appointments
  // Неоплаченные брони: их нужно оплатить, иначе слот вернётся врачу.
  //
  // Истёкшие сюда не попадают: sweep отменяет их не мгновенно (фоновый проход —
  // раз в минуту), а блок «Ожидает оплаты» с кнопкой оплаты для брони, слот
  // которой уже вернулся врачу, только путает — оплатить её всё равно нельзя.
  const pendingPaymentAppointments = appointments.filter(
    (a) =>
      a.status === "pending_payment" &&
      (!a.paymentExpiresAt || new Date(a.paymentExpiresAt).getTime() > Date.now()),
  )
  const upcomingAppointments = appointments.filter((a) =>
    a.status === "confirmed" || a.status === "in_progress",
  )
  const activeAppointments = appointments.filter((a) => a.status === "in_progress")
  const completedAppointments = appointments.filter((a) => a.status === "completed")
  const cancelledAppointments = appointments.filter((a) => a.status === "cancelled")
  
  const counts: Record<FilterType, number> = {
    all: appointments.length,
    upcoming: upcomingAppointments.length,
    completed: completedAppointments.length,
    cancelled: cancelledAppointments.length,
  }

  const filteredAppointments = filter === 'all'
    ? appointments
    : filter === 'upcoming'
      ? upcomingAppointments
      : filter === 'completed'
        ? completedAppointments
        : cancelledAppointments

  return (
    <div className="relative z-10 flex-1">
      {/* Hero banner */}
      <UserHeroBanner
        user={user}
        upcomingCount={upcomingAppointments.length}
        activeCount={activeAppointments.length}
        completedCount={completedAppointments.length}
        onLogout={logout}
        appointments={appointments}
        hasUnreadMessages={hasAnyUnread}
      />

      {/* Appointments list */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Consultation guide for upcoming/active appointments */}
        {(activeAppointments.length > 0 || upcomingAppointments.length > 0) && (
          <ConsultationGuide 
            appointment={activeAppointments[0] || upcomingAppointments[0]} 
          />
        )}

        {/* Неоплаченная бронь — самое срочное действие в кабинете */}
        {pendingPaymentAppointments.length > 0 && (
          <div className="relative mb-4 overflow-hidden rounded-2xl bg-amber-50 shadow-[0_0_0_1px_oklch(0.769_0.16_70_/_0.35)] dark:bg-amber-500/10">
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 w-[3px] bg-amber-500"
            />
            <div className="flex flex-col gap-3 pl-6 pr-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-400">
                  Требуется оплата
                </p>
                <p className="mt-1.5 text-[15px] font-semibold text-foreground">
                  {pendingPaymentAppointments.length === 1
                    ? "Запись ожидает оплаты"
                    : `Записи ожидают оплаты: ${pendingPaymentAppointments.length}`}
                </p>
                <p className="mt-1 text-pretty text-[13px] leading-relaxed text-muted-foreground">
                  Время у врача забронировано ненадолго. Если не оплатить, слот вернётся
                  в расписание.
                </p>
              </div>
              <Button
                asChild
                size="sm"
                className="shrink-0 rounded-full bg-amber-500 px-5 text-white hover:bg-amber-600"
              >
                <Link href={`/appointment/${pendingPaymentAppointments[0].id}/payment`}>
                  Перейти к ��плате
                </Link>
              </Button>
            </div>
          </div>
        )}

        {/* Feedback prompt for completed consultations */}
        <FeedbackPrompt appointments={appointments} userId={user.id} />

        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal">
              История приёмов
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-[-0.01em] text-foreground">
              Мои записи
            </h2>
          </div>

          <div className="w-full lg:hidden">
            <Select value={filter} onValueChange={(value) => changeFilter(value as FilterType)}>
              <SelectTrigger className="h-11 w-full rounded-xl bg-card px-4 shadow-sm" aria-label="Фильтр записей">
                <SelectValue placeholder="Выберите раздел" />
              </SelectTrigger>
              <SelectContent position="popper" align="end" className="min-w-[var(--radix-select-trigger-width)] rounded-xl">
                <SelectGroup>
                  {FILTERS.map((item) => (
                    <SelectItem key={item.id} value={item.id} className="py-2.5">
                      {item.label} ({counts[item.id]})
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div role="tablist" aria-label="Фильтр записей" className="hidden items-center rounded-xl bg-muted p-1 lg:flex">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={filter === item.id}
                onClick={() => changeFilter(item.id)}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  filter === item.id
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label} ({counts[item.id]})
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-3 py-16">
            <span className="h-7 w-7 animate-spin rounded-full border-2 border-teal border-t-transparent" />
            <span className="text-sm text-muted-foreground">Загру��аем записи…</span>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-5 rounded-2xl bg-card px-6 py-14 text-center shadow-[0_0_0_1px_oklch(0_0_0_/_0.07)]">
            {/* Линия ЭКГ вместо родовой иконки — мотив бренда */}
            <svg
              className="h-10 w-40 text-teal/50"
              viewBox="0 0 240 40"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M0 20 H86 l7 0 5 -14 6 28 5 -33 5 38 5 -19 H240"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            <div className="max-w-sm">
              <p className="text-[17px] font-bold tracking-[-0.01em] text-foreground">
                {EMPTY_STATE[filter].title}
              </p>
              <p className="mt-1.5 text-pretty text-sm leading-relaxed text-muted-foreground">
                {EMPTY_STATE[filter].hint}
              </p>
            </div>

            {(filter === 'all' || filter === 'upcoming') && (
              <Button asChild size="sm" className="rounded-full px-6">
                <Link href="/appointment">Найти врача</Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredAppointments.map((appt) => (
              <UserAppointmentCard
                key={appt.id}
                appointment={appt}
                hasUnreadMessages={hasUnread(appt.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
