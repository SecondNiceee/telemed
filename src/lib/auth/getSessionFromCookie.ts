import jwt from 'jsonwebtoken'
import { getPayload } from 'payload'
import config from '@payload-config'
import { extractCookie } from '@/lib/auth-cookies'

type AuthCollection = 'users' | 'doctors' | 'organisations'

/**
 * Server-side helper to authenticate a user from a specific cookie.
 *
 * Since payload.auth() only checks the primary admin collection (users),
 * we need this helper for doctors and organisations collections.
 *
 * ВАЖНО: подпись токена обязательно проверяется (jwt.verify).
 *
 * Раньше здесь стоял jwt.decode(), который подпись НЕ проверяет: он просто
 * распаковывает base64. От этой функции зависит вход во все кабинеты
 * (/lk-org/*, /lk-med/*, /doctor-dashboard), поэтому самодельная cookie вида
 * `organisations-token=<любой id>` открывала кабинет чужой клиники - её
 * консультации, пациентов и врачей, - а `doctors-token` давал доступ к чату
 * врача с пациентами. Пароль при этом не требовался.
 *
 * Дополнительно:
 *  - algorithms фиксируем на HS256, иначе возможна подмена алгоритма (alg: none);
 *  - сверяем collection из токена с запрошенной коллекцией, чтобы токен врача
 *    не работал как токен организации.
 *
 * Usage in RSC:
 *   const org = await getSessionFromCookie(await headers(), 'organisations-token', 'organisations')
 */
export async function getSessionFromCookie<T = unknown>(
  requestHeaders: Headers,
  cookieName: string,
  collection: AuthCollection,
): Promise<T | null> {
  try {
    const token = extractCookie(requestHeaders.get('cookie') || '', cookieName)
    if (!token) return null

    const payload = await getPayload({ config })

    let decoded: { id?: string | number; collection?: string } | null = null
    try {
      // decodeURIComponent - на случай, если cookie сохранена в закодированном
      // виде. Символы JWT (A-Za-z0-9-_.) декодирование не меняет.
      decoded = jwt.verify(decodeURIComponent(token), payload.secret, {
        algorithms: ['HS256'],
      }) as {
        id?: string | number
        collection?: string
      }
    } catch {
      // Просроченный, поддельный или подписанный чужим секретом токен.
      return null
    }

    if (!decoded?.id) return null
    // Токен, выданный для другой коллекции, не должен пускать в этот кабинет.
    if (decoded.collection && decoded.collection !== collection) return null

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
