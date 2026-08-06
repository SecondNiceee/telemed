import jwt from 'jsonwebtoken'

const TOKEN_EXPIRATION = 60 * 60 * 24 * 7 // 7 days

const IS_PRODUCTION = process.env.NODE_ENV === 'production'

/**
 * Build a Set-Cookie header string for a given cookie name and JWT token.
 */
export function buildSetCookie(cookieName: string, token: string): string {
  return [
    `${cookieName}=${token}`,
    `Path=/`,
    `HttpOnly`,
    `Max-Age=${TOKEN_EXPIRATION}`,
    `SameSite=Lax`,
    ...(IS_PRODUCTION ? ['Secure'] : []),
  ].join('; ')
}

/**
 * Build a Set-Cookie header string that clears (expires) a cookie.
 */
export function buildClearCookie(cookieName: string): string {
  return [
    `${cookieName}=`,
    `Path=/`,
    `HttpOnly`,
    `Max-Age=0`,
    `SameSite=Lax`,
    ...(IS_PRODUCTION ? ['Secure'] : []),
  ].join('; ')
}

/**
 * Sign a JWT for a given collection user.
 */
export function signCollectionToken(
  payload: { id: number | string; collection: string; email: string; role?: string },
  secret: string,
): string {
  return jwt.sign(
    {
      id: payload.id,
      collection: payload.collection,
      email: payload.email,
      ...(payload.role ? { role: payload.role } : {}),
    },
    secret,
    { expiresIn: TOKEN_EXPIRATION },
  )
}

/**
 * Extract a specific cookie value from the Cookie header string.
 */
export function extractCookie(cookieHeader: string, cookieName: string): string | null {
  const match = cookieHeader.match(new RegExp(`${cookieName}=([^;]+)`))
  return match ? match[1] : null
}

export { TOKEN_EXPIRATION }
