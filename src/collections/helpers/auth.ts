import type { PayloadRequest } from 'payload'
import jwt from 'jsonwebtoken'
import { getPayloadJwtSecret } from '@/lib/server/payload-jwt-secret'

/**
 * Token cookie names for each auth collection:
 *  - users       → payload-token
 *  - doctors     → doctors-token  (Payload derives from slug)
 *  - organisations → organisations-token
 */


export type AuthCollection = 'users' | 'doctors' | 'organisations'

export interface DecodedCaller {
  id: string
  collection: AuthCollection
  /** For users collection, this is the role field (user/admin). For doctors/organisations it's the collection name. */
  role: string
  email?: string
}

interface TokenPayload {
  id?: string | number
  role?: string
  email?: string
  collection?: string
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

let secretMissingLogged = false

/**
 * Verify a JWT from a specific cookie name.
 *
 * ВАЖНО: подпись обязательно проверяется. Cookie приходит из внешнего запроса,
 * поэтому её содержимое подделывается кем угодно: `jwt.decode()` без проверки
 * позволял прислать самодельный токен с `{"role":"admin"}` и пройти любые
 * access-функции (бесплатная подтверждённая запись, правка расписания врача и т.д.).
 */
function verifyCookie(cookieHeader: string, cookieName: string): TokenPayload | null {
  const regex = new RegExp(`(?:^|;\\s*)${cookieName}=([^;]+)`)
  const match = cookieHeader.match(regex)
  if (!match) return null

  const secret = getPayloadJwtSecret()
  if (!secret) {
    if (!secretMissingLogged) {
      secretMissingLogged = true
      console.error('[auth] PAYLOAD_SECRET не задан — проверка токенов невозможна, доступ запрещён')
    }
    return null
  }

  try {
    // algorithms фиксируем явно, чтобы исключить algorithm confusion (alg: none / RS256).
    return jwt.verify(decodeURIComponent(match[1]), secret, {
      algorithms: ['HS256'],
    }) as TokenPayload
  } catch {
    return null
  }
}

function roleForCollection(collection: AuthCollection, tokenRole?: string): string {
  if (collection === 'users') return tokenRole || 'user'
  if (collection === 'doctors') return 'doctor'
  return 'organisation'
}



const COOKIE_MAP: Record<AuthCollection, string> = {
  users: 'payload-token',
  doctors: 'doctors-token',
  organisations: 'organisations-token',
}

/**
 * Get the caller's role, id, and collection.
 *
 * Сначала используется `req.user` — его заполняет сам Payload после успешной
 * аутентификации (или Local API), это уже доверенный источник. Если его нет,
 * токен берётся из cookie и его подпись проверяется.
 *
 * @param callerType - When provided, only the cookie for that specific collection is consulted
 *   in the fallback path. This prevents cross-collection cookie conflicts (e.g. an organisation
 *   request accidentally picking up a doctors-token).
 */
export function getCallerFromRequest(
  req: PayloadRequest,
  callerType?: AuthCollection,
): { role?: string; id?: string; collection?: AuthCollection; email?: string } {
  if (!callerType) return {}

  // Доверенный источник: Payload уже проверил токен сам.
  const reqUser = req.user as unknown as TokenPayload | null | undefined
  if (reqUser?.id && reqUser.collection === callerType) {
    return {
      role: roleForCollection(callerType, reqUser.role),
      id: String(reqUser.id),
      collection: callerType,
      email: reqUser.email,
    }
  }

  // Fallback: читаем токен из cookie и проверяем подпись.
  const cookieHeader = getCookieHeader(req)
  if (!cookieHeader) return {}

  const verified = verifyCookie(cookieHeader, COOKIE_MAP[callerType])
  if (!verified?.id) return {}

  // Токен, выданный для другой коллекции, не должен работать как этот тип вызывающего.
  if (verified.collection && verified.collection !== callerType) return {}

  return {
    role: roleForCollection(callerType, verified.role),
    id: String(verified.id),
    collection: callerType,
    email: verified.email,
  }
}
