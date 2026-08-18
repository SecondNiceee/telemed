import { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS, rateLimitMap } from "../config/rate-limit.config"

// Проверка rate-limit по произвольному ключу.
// ВАЖНО: ключ должен быть привязан к личности пользователя (напр. "user:42"),
// а не к socket.id — иначе несколько вкладок/сокетов у одного человека
// дают ему кратно больше лимита.
export default function isRateLimited(key: string): boolean {
    const now = Date.now()
    const entry = rateLimitMap.get(key)
  
    if (!entry || now > entry.resetAt) {
      // New window
      rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
      return false
    }
  
    if (entry.count >= RATE_LIMIT_MAX) {
      return true
    }
  
    entry.count++
    return false
  }
