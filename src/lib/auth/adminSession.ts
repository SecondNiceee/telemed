import jwt from 'jsonwebtoken'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { User } from '@/payload-types'
import { extractCookie } from '@/lib/auth-cookies'

/** Cookie, в которой лежит токен коллекции users. */
export const USERS_COOKIE = 'payload-token'

export interface AdminSession {
  user: User
}

/**
 * Возвращает пользователя из cookie `payload-token`, только если у него роль admin.
 *
 * В отличие от getSessionFromCookie() здесь подпись токена проверяется (jwt.verify),
 * потому что от этой функции зависит доступ к панели управления: подделанная
 * cookie не должна давать админские права.
 */
export async function getAdminFromCookieHeader(cookieHeader: string): Promise<User | null> {
  const token = extractCookie(cookieHeader || '', USERS_COOKIE)
  if (!token) return null

  const payload = await getPayload({ config })

  let decoded: { id?: string | number } | null = null
  try {
    decoded = jwt.verify(token, payload.secret) as { id?: string | number }
  } catch {
    return null
  }
  if (!decoded?.id) return null

  try {
    const user = await payload.findByID({
      collection: 'users',
      id: decoded.id,
      depth: 0,
      overrideAccess: true,
    })
    if (!user || user.role !== 'admin') return null
    return user as User
  } catch {
    return null
  }
}

/** Есть ли в системе хотя бы один пользователь — нужно для первичной настройки. */
export async function hasAnyUser(): Promise<boolean> {
  const payload = await getPayload({ config })
  const { totalDocs } = await payload.count({
    collection: 'users',
    overrideAccess: true,
  })
  return totalDocs > 0
}

/** Убирает из документа поля аутентификации перед отдачей клиенту. */
export function stripAuthFields<T extends Record<string, unknown>>(doc: T): Omit<T, 'hash' | 'salt'> {
  const { hash: _hash, salt: _salt, ...safe } = doc
  return safe as Omit<T, 'hash' | 'salt'>
}
