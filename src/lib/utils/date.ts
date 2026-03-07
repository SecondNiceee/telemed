/**
 * Format date string to Russian locale (e.g., "15 марта 2024")
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00")
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
export function getStatusLabel(status: 'confirmed' | 'completed' | 'cancelled'): string {
  switch (status) {
    case "confirmed":
      return "Подтверждена"
    case "completed":
      return "Завершена"
    case "cancelled":
      return "Отменена"
  }
}

/**
 * Get status color classes for Tailwind
 */
export function getStatusColor(status: 'confirmed' | 'completed' | 'cancelled'): string {
  switch (status) {
    case "confirmed":
      return "bg-green-100 text-green-700 border border-green-200"
    case "completed":
      return "bg-muted text-muted-foreground border border-border"
    case "cancelled":
      return "bg-destructive/10 text-destructive border border-destructive/20"
  }
}
