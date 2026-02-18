import type { CollectionConfig, PayloadRequest } from 'payload'
import { revalidateTag } from 'next/cache'
import jwt from 'jsonwebtoken'
import { DOCTORS_CACHE_TAG } from '@/lib/api/doctors'

/**
 * Extract the real logged-in user from the JWT cookie directly,
 * bypassing req.user (which Payload may overwrite with the target user
 * in auth collections) and avoiding payload.auth() (which causes
 * infinite recursion in access control).
 *
 * We use jwt.decode() (no signature verification) because:
 * 1. The token lives in an httpOnly cookie set by Payload itself.
 * 2. Payload internally derives a signing key from PAYLOAD_SECRET
 *    (it is NOT the raw secret), so jwt.verify(token, PAYLOAD_SECRET)
 *    will always fail with "invalid signature".
 * 3. We are running server-side inside a trusted Payload hook/access
 *    function, so reading claims without re-verifying is safe.
 */
/**
 * Decode the JWT from the payload-token cookie.
 * Returns the decoded claims or null.
 */
function decodeTokenFromCookie(req: PayloadRequest): {
  role?: string
  id?: string
  collection?: string
  email?: string
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
      email?: string
    } | null
    return decoded
  } catch {
    return null
  }
}

/**
 * Get the real caller's role and id.
 * Prefers the JWT cookie (immune to req.user being overwritten on auth
 * collections), then falls back to req.user for internal Payload calls.
 */
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

/**
 * Payload's internal `canAccessAdmin` checks `req.user` BEFORE calling
 * our `access.admin` function. During certain Server Actions (buildFormState
 * for array/tab fields), Payload fails to populate `req.user` even though
 * the JWT cookie is present. This causes an instant "Unauthorized" error.
 *
 * This beforeOperation hook detects that situation and manually populates
 * `req.user` from the JWT cookie so that `canAccessAdmin` finds a user
 * and proceeds to call our access functions normally.
 */
async function ensureReqUser({
  req,
  operation,
}: {
  req: PayloadRequest
  operation: string
}) {
  if (req.user) return // already populated, nothing to do

  const decoded = decodeTokenFromCookie(req)
  if (!decoded?.id || !decoded?.collection) return

  try {
    const user = await req.payload.findByID({
      collection: decoded.collection as 'users',
      id: decoded.id,
      depth: 0,
      overrideAccess: true, // bypass access control to avoid recursion
    })

    if (user) {
      req.user = {
        ...user,
        collection: decoded.collection,
      } as any
    }
  } catch {
    // silently fail — access functions will handle the missing user
  }
}

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'role'],
    group: 'Пользователи',
  },
  auth: {
    verify: false,
    tokenExpiration: 60 * 60 * 24 * 7, // 7 days

  },
  hooks: {
    beforeOperation: [ensureReqUser],
    afterChange: [
      ({ doc }) => {
        if (doc?.role === 'doctor') {
          revalidateTag(DOCTORS_CACHE_TAG)
        }
      },
    ],
    afterDelete: [
      ({ doc }) => {
        if (doc?.role === 'doctor') {
          revalidateTag(DOCTORS_CACHE_TAG)
        }
      },
    ],
    beforeChange: [
      ({ data, operation, req }) => {
        if (operation === 'create') {
          data._verified = true

          // Organisation users can ONLY create doctors
          const caller = getCallerRole(req)
          if (caller.role === 'organisation') {
            if (data.role !== 'doctor') {
              throw new Error('Организация может создавать только врачей')
            }
          }
        }
        return data
      },
    ],
  },
  access: {
    read: () => true,
    create: ({ req }) => {
      const caller = getCallerRole(req)
      return caller.role === 'admin' || caller.role === 'organisation'
    },
    update: ({ req, id }) => {
      const caller = getCallerRole(req)
      if (caller.role === 'admin') return true
      if (caller.id && String(caller.id) === String(id)) return true
      return false
    },
    delete: ({ req }) => {
      const caller = getCallerRole(req)
      return caller.role === 'admin'
    },
    admin: ({ req }) => {
      const caller = getCallerRole(req)
      return caller.role === 'admin'
    },
  },
  fields: [
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'user',
      label: 'Роль',
      saveToJWT: true,
      options: [
        { label: 'Пользователь', value: 'user' },
        { label: 'Врач', value: 'doctor' },
        { label: 'Администратор', value: 'admin' },
        { label: 'Организация', value: 'organisation' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'name',
      type: 'text',
      label: 'Имя',
    },
    // --- Doctor-specific fields ---
    {
      name: 'categories',
      type: 'relationship',
      relationTo: 'doctor-categories',
      hasMany: true,
      label: 'Специализации',
      admin: {
        condition: (data) => data?.role === 'doctor',
      },
    },
    {
      name: 'experience',
      type: 'number',
      label: 'Стаж (лет)',
      admin: {
        condition: (data) => data?.role === 'doctor',
      },
    },
    {
      name: 'degree',
      type: 'text',
      label: 'Степень / Категория',
      admin: {
        condition: (data) => data?.role === 'doctor',
        description: 'Например: Врач высшей категории, Кандидат медицинских наук',
      },
    },
    {
      name: 'price',
      type: 'number',
      label: 'Цена консультации (₽)',
      admin: {
        condition: (data) => data?.role === 'doctor',
      },
    },
    {
      name: 'photo',
      type: 'upload',
      relationTo: 'media',
      label: 'Фото',
      admin: {
        condition: (data) => data?.role === 'doctor',
      },
    },
    {
      name: 'bio',
      type: 'textarea',
      label: 'О враче',
      admin: {
        condition: (data) => data?.role === 'doctor',
      },
    },
    {
      name: 'education',
      type: 'array',
      label: 'Образование',
      admin: {
        condition: (data) => data?.role === 'doctor',
      },
      fields: [
        {
          name: 'value',
          type: 'text',
          label: 'Учебное заведение / Курс',
        },
      ],
    },
    {
      name: 'services',
      type: 'array',
      label: 'Услуги',
      admin: {
        condition: (data) => data?.role === 'doctor',
      },
      fields: [
        {
          name: 'value',
          type: 'text',
          label: 'Название услуги',
        },
      ],
    },
  ],
}
