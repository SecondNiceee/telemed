import { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS, rateLimitMap } from "../config/rate-limit.config"

// Довольно замысловатая функция isRateLimited
export default function isRateLimited(socketId: string): boolean {
    const now = Date.now()
    const entry = rateLimitMap.get(socketId)
  
    if (!entry || now > entry.resetAt) {
      // New window
      rateLimitMap.set(socketId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
      return false
    }
  
    if (entry.count >= RATE_LIMIT_MAX) {
      return true
    }
  
    entry.count++
    return false
  }
