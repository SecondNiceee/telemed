// Просто тип RateLimit
export interface RateLimitEntry {
    count: number
    resetAt: number
  }
export const rateLimitMap = new Map<string, RateLimitEntry>()
export const RATE_LIMIT_MAX = 10 // Максимальное количество сообщений в RATE_LIMIT_WINDOW_MS у одного window
export const RATE_LIMIT_WINDOW_MS = 1000 // Выше 