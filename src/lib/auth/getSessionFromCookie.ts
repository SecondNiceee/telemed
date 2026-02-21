import jwt from 'jsonwebtoken'
import { getPayload } from 'payload'
import config from '@payload-config'

type AuthCollection = 'users' | 'doctors' | 'organisations'

/**
 * Server-side helper to authenticate a user from a specific cookie.
 *
 * Since payload.auth() only checks the primary admin collection (users),
 * we need this helper for doctors and organisations collections.
 *
 * Usage in RSC:
 *   const org = await getSessionFromCookie(await headers(), 'organisations-token', 'organisations')
 */
export async function getSessionFromCookie<T = any>(
  requestHeaders: Headers,
  cookieName: string,
  collection: AuthCollection,
): Promise<T | null> {
  try {
    const cookieHeader = requestHeaders.get('cookie') || ''
    const regex = new RegExp(`${cookieName}=([^;]+)`)
    const match = cookieHeader.match(regex)
    if (!match) return null

    const decoded = jwt.decode(match[1]) as { id?: string | number; collection?: string } | null
    if (!decoded?.id) return null

    const payload = await getPayload({ config })
    const doc = await payload.findByID({
      collection,
      id: decoded.id,
      depth: 0,
      overrideAccess: true,
    })

    return (doc as T) ?? null
  } catch {
    return null
  }
}
