import type { PayloadRequest } from 'payload'
import jwt from 'jsonwebtoken'

/**
 * Token cookie names for each auth collection:
 *  - users       → payload-token
 *  - doctors     → doctors-token  (Payload derives from slug)
 *  - organisations → organisations-token
 */
const AUTH_COOKIES = [
  { name: 'payload-token', collection: 'users' as const },
  { name: 'doctors-token', collection: 'doctors' as const },
  { name: 'organisations-token', collection: 'organisations' as const },
] as const

export type AuthCollection = 'users' | 'doctors' | 'organisations'

export interface DecodedCaller {
  id: string
  collection: AuthCollection
  /** For users collection, this is the role field (user/admin). For doctors/organisations it's the collection name. */
  role: string
  email?: string
}

/**
 * Extract cookie header string from PayloadRequest regardless of the header format.
 */
function getCookieHeader(req: PayloadRequest): string {
  try {
    if (typeof req.headers?.get === 'function') {
      return req.headers.get('cookie') || ''
    }
    if (req.headers && typeof req.headers === 'object') {
      return (req.headers as any)['cookie'] || (req.headers as any).cookie || ''
    }
  } catch {
    // ignore
  }
  return ''
}

/**
 * Decode JWT from a specific cookie name.
 * Uses jwt.decode() (no signature verification) because we run server-side
 * inside trusted Payload hooks/access functions and the cookie was set by Payload itself.
 */
function decodeCookie(cookieHeader: string, cookieName: string): Record<string, any> | null {
  const regex = new RegExp(`${cookieName}=([^;]+)`)
  const match = cookieHeader.match(regex)
  if (!match) return null

  try {
    return jwt.decode(match[1]) as Record<string, any> | null
  } catch {
    return null
  }
}

/**
 * Decode JWTs from ALL auth-collection cookies.
 * Returns the first valid decoded token found (priority: users > doctors > organisations).
 */
export function decodeAnyCookie(req: PayloadRequest): DecodedCaller | null {
  const cookieHeader = getCookieHeader(req)
  if (!cookieHeader) return null

  for (const { name, collection } of AUTH_COOKIES) {
    const decoded = decodeCookie(cookieHeader, name)
    if (decoded?.id) {
      let role: string
      if (collection === 'users') {
        role = decoded.role || 'user'
      } else if (collection === 'doctors') {
        role = 'doctor'
      } else {
        role = 'organisation'
      }

      return {
        id: String(decoded.id),
        collection,
        role,
        email: decoded.email,
      }
    }
  }

  return null
}

/**
 * Decode ONLY the users collection cookie (payload-token).
 * Used by ensureReqUser to avoid overriding req.user with non-user entities.
 */
export function decodeUsersCookie(req: PayloadRequest): DecodedCaller | null {
  const cookieHeader = getCookieHeader(req)
  if (!cookieHeader) return null

  const decoded = decodeCookie(cookieHeader, 'payload-token')
  if (!decoded?.id) return null

  return {
    id: String(decoded.id),
    collection: 'users',
    role: decoded.role || 'user',
    email: decoded.email,
  }
}

/**
 * Decode JWT from a SPECIFIC cookie.
 */
export function decodeSpecificCookie(
  req: PayloadRequest,
  cookieName: string,
  collection: AuthCollection,
): DecodedCaller | null {
  const cookieHeader = getCookieHeader(req)
  if (!cookieHeader) return null

  const decoded = decodeCookie(cookieHeader, cookieName)
  if (!decoded?.id) return null

  let role: string
  if (collection === 'users') {
    role = decoded.role || 'user'
  } else if (collection === 'doctors') {
    role = 'doctor'
  } else {
    role = 'organisation'
  }

  return {
    id: String(decoded.id),
    collection,
    role,
    email: decoded.email,
  }
}

/**
 * Get the caller's role and id. Checks req.user first (populated by Payload from DB,
 * includes real role), then falls back to cookie decode.
 */
export function getCallerFromRequest(req: PayloadRequest): { role?: string; id?: string; collection?: AuthCollection } {
  // 1. Prefer req.user — Payload populates it from the DB, so it has the real role.
  const user = req.user as { role?: string; id?: string | number; collection?: string } | undefined
  if (user?.id) {
    return {
      role: user.role || (user.collection === 'doctors' ? 'doctor' : user.collection === 'organisations' ? 'organisation' : 'user'),
      id: String(user.id),
      collection: (user.collection as AuthCollection) || 'users',
    }
  }

  // 2. Fallback: decode JWT from cookies (e.g. when req.user is not yet populated).
  const decoded = decodeAnyCookie(req)
  if (decoded) {
    return { role: decoded.role, id: decoded.id, collection: decoded.collection }
  }

  return {}
}
