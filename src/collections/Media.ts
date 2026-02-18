import type { CollectionConfig, PayloadRequest } from 'payload'
import jwt from 'jsonwebtoken'

/**
 * Decode the JWT from the payload-token cookie.
 * This is needed because req.user may not be populated correctly
 * during certain operations (e.g. media upload from the org dashboard).
 */
function decodeTokenFromCookie(req: PayloadRequest): {
  role?: string
  id?: string
  collection?: string
} | null {
  try {
    let cookieHeader = ''
    if (typeof req.headers?.get === 'function') {
      cookieHeader = req.headers.get('cookie') || ''
    } else if (req.headers && typeof req.headers === 'object') {
      cookieHeader = (req.headers as any)['cookie'] || (req.headers as any).cookie || ''
    }

    const match = cookieHeader.match(/payload-token=([^;]+)/)
    if (!match) return null

    const decoded = jwt.decode(match[1]) as {
      role?: string
      id?: string
      collection?: string
    } | null
    return decoded
  } catch {
    return null
  }
}

function getCallerRole(req: PayloadRequest): { role?: string; id?: string } {
  const decoded = decodeTokenFromCookie(req)
  if (decoded) {
    return { role: decoded.role, id: decoded.id ? String(decoded.id) : undefined }
  }

  const user = req.user as { role?: string; id?: string | number } | undefined
  if (user) {
    return { role: user.role, id: user.id ? String(user.id) : undefined }
  }

  return {}
}

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
    create: ({ req }) => {
      const caller = getCallerRole(req)
      return caller.role === 'admin' || caller.role === 'organisation'
    },
    update: ({ req }) => {
      const caller = getCallerRole(req)
      return caller.role === 'admin' || caller.role === 'organisation'
    },
    delete: ({ req }) => {
      const caller = getCallerRole(req)
      return caller.role === 'admin'
    },
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: false,
    },
  ],
  upload: true,
}
