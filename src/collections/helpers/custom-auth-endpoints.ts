import type { Endpoint } from 'payload'
import jwt from 'jsonwebtoken'

interface CustomAuthEndpointsConfig {
  /** Collection slug, e.g. 'doctors' or 'organisations' */
  slug: string
  /** Cookie name for this collection, e.g. 'doctors-token' */
  cookieName: string
  /** Token expiration in seconds (default: 7 days) */
  tokenExpiration?: number
}

/**
 * Creates custom login / me / logout endpoints for an auth collection.
 *
 * WHY: PayloadCMS always sets the cookie as `payload-token` regardless of
 * collection slug. These custom endpoints call payload.login() internally
 * but replace the Set-Cookie header with the correct cookie name so that
 * multiple auth collections can coexist in the browser simultaneously.
 */
export function createCustomAuthEndpoints(config: CustomAuthEndpointsConfig): Endpoint[] {
  const { slug, cookieName, tokenExpiration = 60 * 60 * 24 * 7 } = config

  const loginEndpoint: Endpoint = {
    path: '/custom-login',
    method: 'post',
    handler: async (req) => {
      const payload = req.payload
      const secret = payload.secret

      // Parse body
      let email: string
      let password: string
      try {
        const body = typeof req.json === 'function' ? await req.json() : (req as any).body
        email = body?.email
        password = body?.password
      } catch {
        return Response.json(
          { message: 'Invalid request body' },
          { status: 400 },
        )
      }

      if (!email || !password) {
        return Response.json(
          { message: 'Email and password are required' },
          { status: 400 },
        )
      }

      // Use payload.login() which validates credentials & returns user + token
      let result: { token?: string; user: any; exp?: number }
      try {
        result = await payload.login({
          collection: slug as any,
          data: { email, password },
          // Don't let Payload set its own cookie -- we do it manually
          req,
        })
      } catch (err: any) {
        const message = err?.message || 'Invalid credentials'
        return Response.json({ message }, { status: 401 })
      }

      // Build our own JWT with the correct collection info
      const tokenData: Record<string, any> = {
        id: result.user.id,
        collection: slug,
        email: result.user.email,
      }

      // Include role in token for users collection
      if (result.user.role) {
        tokenData.role = result.user.role
      }

      const token = jwt.sign(tokenData, secret, {
        expiresIn: tokenExpiration,
      })

      const isProduction = process.env.NODE_ENV === 'production'
      const cookieStr = [
        `${cookieName}=${token}`,
        `Path=/`,
        `HttpOnly`,
        `Max-Age=${tokenExpiration}`,
        `SameSite=Lax`,
        ...(isProduction ? ['Secure'] : []),
      ].join('; ')

      // Also clear the default payload-token to avoid conflicts
      const clearPayloadCookie = [
        `payload-token=`,
        `Path=/`,
        `HttpOnly`,
        `Max-Age=0`,
        `SameSite=Lax`,
        ...(isProduction ? ['Secure'] : []),
      ].join('; ')

      return new Response(
        JSON.stringify({
          message: 'Auth Passed',
          token,
          user: result.user,
          exp: Math.floor(Date.now() / 1000) + tokenExpiration,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': [cookieStr, clearPayloadCookie].join(', '),
          },
        },
      )
    },
  }

  const meEndpoint: Endpoint = {
    path: '/custom-me',
    method: 'get',
    handler: async (req) => {
      const payload = req.payload
      const secret = payload.secret

      // Extract our specific cookie
      let cookieHeader = ''
      try {
        if (typeof req.headers?.get === 'function') {
          cookieHeader = req.headers.get('cookie') || ''
        }
      } catch {
        // ignore
      }

      const regex = new RegExp(`${cookieName}=([^;]+)`)
      const match = cookieHeader.match(regex)

      if (!match) {
        return Response.json({ user: null }, { status: 200 })
      }

      // Verify the token (not just decode -- full verification with secret)
      let decoded: any
      try {
        decoded = jwt.verify(match[1], secret)
      } catch {
        return Response.json({ user: null }, { status: 200 })
      }

      if (!decoded?.id) {
        return Response.json({ user: null }, { status: 200 })
      }

      // Fetch full user from DB
      try {
        const user = await payload.findByID({
          collection: slug as any,
          id: decoded.id,
          depth: 1,
          overrideAccess: true,
        })

        if (!user) {
          return Response.json({ user: null }, { status: 200 })
        }

        // Strip sensitive fields
        const { hash, salt, ...safeUser } = user as any

        return Response.json({ user: safeUser }, { status: 200 })
      } catch {
        return Response.json({ user: null }, { status: 200 })
      }
    },
  }

  const logoutEndpoint: Endpoint = {
    path: '/custom-logout',
    method: 'post',
    handler: async () => {
      const isProduction = process.env.NODE_ENV === 'production'

      // Clear our collection-specific cookie
      const clearCookie = [
        `${cookieName}=`,
        `Path=/`,
        `HttpOnly`,
        `Max-Age=0`,
        `SameSite=Lax`,
        ...(isProduction ? ['Secure'] : []),
      ].join('; ')

      // Also clear payload-token just in case
      const clearPayloadCookie = [
        `payload-token=`,
        `Path=/`,
        `HttpOnly`,
        `Max-Age=0`,
        `SameSite=Lax`,
        ...(isProduction ? ['Secure'] : []),
      ].join('; ')

      return new Response(
        JSON.stringify({ message: 'Logged out successfully' }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': [clearCookie, clearPayloadCookie].join(', '),
          },
        },
      )
    },
  }

  return [loginEndpoint, meEndpoint, logoutEndpoint]
}
