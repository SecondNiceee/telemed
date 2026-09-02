import type { Payload } from 'payload'
import type { Server as SocketIOServer } from 'socket.io'
import type { SupportConversation, SupportMessage } from '@/payload-types'

/** Namespace для анонимных посетителей — отдельный от основного. */
export const SUPPORT_NAMESPACE = '/support'

/** Сколько последних сообщений отдаём при возврате на сайт. */
export const HISTORY_LIMIT = 50

export interface SupportMessageDto {
  id: number
  sender: 'visitor' | 'operator'
  text: string
  createdAt: string
}

export interface SupportAck {
  success: boolean
  error?: string
  publicId?: string
  messages?: SupportMessageDto[]
}

export function toDto(message: SupportMessage): SupportMessageDto {
  return {
    id: message.id,
    sender: message.sender,
    text: message.text,
    createdAt: message.createdAt,
  }
}

export function roomName(publicId: string): string {
  return `support:${publicId}`
}

/**
 * Отдельный rate limit для поддержки.
 *
 * Общий `isRateLimited` берёт лимит из глобальной константы (10 сообщений в
 * секунду) — для авторизованного чата это разумно, но анонимной поддержке
 * нужен свой, более строгий счётчик. Своя карта ещё и изолирует поддержку:
 * флуд в виджете не съест лимит консультаций.
 */
const supportLimits = new Map<string, { count: number; resetAt: number }>()

const SUPPORT_LIMIT_MAX = 5
const SUPPORT_LIMIT_WINDOW_MS = 10_000

export function isSupportRateLimited(key: string): boolean {
  const now = Date.now()
  const entry = supportLimits.get(key)

  if (!entry || now > entry.resetAt) {
    supportLimits.set(key, { count: 1, resetAt: now + SUPPORT_LIMIT_WINDOW_MS })
    return false
  }

  if (entry.count >= SUPPORT_LIMIT_MAX) return true

  entry.count++
  return false
}

/** Периодическая уборка, чтобы карта не росла бесконечно. */
export function cleanupSupportLimits(): void {
  const now = Date.now()
  for (const [key, entry] of supportLimits.entries()) {
    if (now > entry.resetAt) supportLimits.delete(key)
  }
}

/** Найти диалог по публичному идентификатору. */
export async function findConversation(
  payload: Payload,
  publicId: unknown,
): Promise<SupportConversation | null> {
  if (typeof publicId !== 'string' || publicId.length < 16) return null

  const result = await payload.find({
    collection: 'support-conversations',
    where: { publicId: { equals: publicId } },
    limit: 1,
    depth: 0,
  })

  return result.docs[0] ?? null
}

/**
 * Разослать сообщение всем открытым вкладкам посетителя.
 *
 * Живёт здесь, а не в мосте Telegram, потому что вызывается с двух сторон:
 * и когда пишет посетитель, и когда отвечает оператор.
 */
export function emitToVisitor(
  io: SocketIOServer,
  publicId: string,
  message: SupportMessageDto,
): void {
  io.of(SUPPORT_NAMESPACE).to(roomName(publicId)).emit('support:message', message)
}

/**
 * Проверка контакта.
 *
 * Нужна не формальности ради: контакт — единственный способ ответить, если
 * посетитель закроет вкладку до ответа. Мусор в этом поле обесценивает всю
 * затею, поэтому телефон и email проверяются, а не принимаются как есть.
 */
export function normalizeContact(
  raw: unknown,
): { value: string; kind: 'phone' | 'email' } | null {
  if (typeof raw !== 'string') return null

  const trimmed = raw.trim()
  if (trimmed.length === 0 || trimmed.length > 100) return null

  if (trimmed.includes('@')) {
    // Намеренно нестрогая проверка: задача — отсечь явный мусор, а не
    // реализовать RFC 5322. Слишком строгий шаблон отвергает валидные адреса.
    const looksLikeEmail = /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/.test(trimmed)
    return looksLikeEmail ? { value: trimmed, kind: 'email' } : null
  }

  const digits = trimmed.replace(/\D/g, '')
  // Российские номера — 11 цифр, но оставляем запас на международные.
  if (digits.length < 10 || digits.length > 15) return null

  return { value: trimmed, kind: 'phone' }
}

/** Имя посетителя: обрезаем, но не придираемся к содержанию. */
export function normalizeName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (trimmed.length === 0) return null
  return trimmed.slice(0, 80)
}
