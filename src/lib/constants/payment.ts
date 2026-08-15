/**
 * Окно оплаты консультации.
 * Пока идёт это окно, слот врача забронирован и недоступен другим пациентам.
 * Если оплата не пройдёт — слот возвращается в расписание.
 */
export const PAYMENT_WINDOW_MINUTES = 15

export const PAYMENT_WINDOW_MS = PAYMENT_WINDOW_MINUTES * 60 * 1000

/** Время истечения брони для новой записи. */
export function getPaymentDeadline(from: Date = new Date()): Date {
  return new Date(from.getTime() + PAYMENT_WINDOW_MS)
}

/** Сколько миллисекунд осталось до истечения брони (0, если истекла). */
export function getMsLeft(expiresAt?: string | null): number {
  if (!expiresAt) return 0
  const left = new Date(expiresAt).getTime() - Date.now()
  return left > 0 ? left : 0
}

/** Формат MM:SS для таймера оплаты. */
export function formatPaymentCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
