/**
 * Format date string to Russian locale (e.g., "15 марта 2024")
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return "Дата не указана"
  const date = new Date(dateStr + "T00:00:00")
  if (isNaN(date.getTime())) return "Некорректная дата"
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

/**
 * Format date to short Russian locale (e.g., "15 марта")
 */
export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00")
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  })
}

/**
 * Get initials from name or email
 */
export function getInitials(name?: string | null, email?: string): string {
  if (name) {
    return name
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
  }
  return email?.[0]?.toUpperCase() ?? "U"
}

/**
 * Get status label in Russian
 */
export function getStatusLabel(status: 'confirmed' | 'in_progress' | 'completed' | 'cancelled'): string {
  switch (status) {
    case "confirmed":
      return "Подтверждена"
    case "in_progress":
      return "В процессе"
    case "completed":
      return "Завершена"
    case "cancelled":
      return "Отменена"
  }
}

/**
 * Get next upcoming confirmed appointment (soonest in the future)
 */
export function getUpcomingAppointment<T extends { date: string; time: string; status: string }>(
  appointments: T[]
): T | null {
  const now = new Date()
  const upcoming = appointments
    .filter((a) => a.status === "confirmed" && a.date && a.time)
    .map((a) => ({
      appt: a,
      dt: new Date(`${a.date}T${a.time}`),
    }))
    .filter(({ dt }) => !isNaN(dt.getTime()) && dt > now)
    .sort((a, b) => a.dt.getTime() - b.dt.getTime())
  
  
  return upcoming[0]?.appt ?? null
}

/**
 * Get diff string "X дней HH:MM:SS" or "HH:MM:SS" until a future datetime
 * Returns null if the date is in the past or invalid
 */
export function getCountdownParts(dateStr: string, timeStr: string): {
  days: number
  hours: number
  minutes: number
  seconds: number
  total: number
} | null {
  if (!dateStr || !timeStr) return null
  const target = new Date(`${dateStr}T${timeStr}`)
  if (isNaN(target.getTime())) return null
  const diff = target.getTime() - Date.now()
  if (diff <= 0) return null

  const total = diff
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)

  return { days, hours, minutes, seconds, total }
}

/**
 * Format countdown parts to readable string
 */
export function formatCountdown(parts: ReturnType<typeof getCountdownParts>): string {
  if (!parts) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  if (parts.days > 0) {
    return `${parts.days} дн. ${pad(parts.hours)}:${pad(parts.minutes)}:${pad(parts.seconds)}`
  }
  return `${pad(parts.hours)}:${pad(parts.minutes)}:${pad(parts.seconds)}`
}

/**
 * Get status color classes for Tailwind
 */
export function getStatusColor(status: 'confirmed' | 'in_progress' | 'completed' | 'cancelled'): string {
  switch (status) {
    case "confirmed":
      return "bg-green-100 text-green-700 border border-green-200"
    case "in_progress":
      return "bg-blue-100 text-blue-700 border border-blue-200"
    case "completed":
      return "bg-muted text-muted-foreground border border-border"
    case "cancelled":
      return "bg-destructive/10 text-destructive border border-destructive/20"
  }
}
