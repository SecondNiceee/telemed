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
      const headers = req.headers as unknown as Record<string, string | undefined>
      return headers['cookie'] || ''
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
function decodeCookie(cookieHeader: string, cookieName: string): { id?: string | number; role?: string; email?: string; collection?: string } | null {
  const regex = new RegExp(`${cookieName}=([^;]+)`)
  const match = cookieHeader.match(regex)
  if (!match) return null

  try {
    return jwt.decode(match[1]) as { id?: string | number; role?: string; email?: string; collection?: string } | null
  } catch {
    return null
  }
}

/**
 * Decode JWTs from ALL auth-collection cookies.
 * Returns the first valid decoded token found (priority: users > doctors > organisations).
 */

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

const COOKIE_MAP: Record<AuthCollection, string> = {
  users: 'payload-token',
  doctors: 'doctors-token',
  organisations: 'organisations-token',
}

/**
 * Get the caller's role, id, and collection from req.user (set by ensureReqUser hooks).
 *
 * @param callerType - When provided, only the cookie for that specific collection is consulted
 *   in the fallback path. This prevents cross-collection cookie conflicts (e.g. an organisation
 *   request accidentally picking up a doctors-token). Admin check always reads the users cookie
 *   regardless of callerType.
 */
export function getCallerFromRequest(
  req: PayloadRequest,
  callerType?: AuthCollection,
): { role?: string; id?: string; collection?: AuthCollection } {

  // Fallback: decode JWT directly from cookies.
  console.log("Я хотя бы тут")
  const cookieHeader = getCookieHeader(req);
  if (!cookieHeader) return {}

  if (callerType) {

    // Then check only the specific cookie for the requested callerType.
    const decoded = decodeCookie(cookieHeader, COOKIE_MAP[callerType]);
    console.log(decoded);
    if (decoded?.id) {
      let role: string
      if (callerType === 'users') {
        role = decoded.role || 'user'
      } else if (callerType === 'doctors') {
        role = 'doctor'
      } else {
        role = 'organisation'
      }
      return { role, id: String(decoded.id), collection: callerType }
    }

    return {}
  }

  // No callerType specified — fall back to the original any-cookie priority chain.
  const decoded = decodeAnyCookie(req)
  if (decoded) {
    return { role: decoded.role, id: decoded.id, collection: decoded.collection }
  }

  return {}
}
