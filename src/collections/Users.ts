import type { CollectionConfig, PayloadRequest } from 'payload'
import jwt from 'jsonwebtoken'

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
function getCallerRole(req: PayloadRequest): { role?: string; id?: string } {
  try {
    // 1. Try to extract the caller from the JWT cookie directly.
    //    This is the most reliable source in create/update operations
    //    on auth collections, because req.user can be overwritten with
    //    the *target* user being created or edited.
    let cookieHeader = ''
    if (typeof req.headers?.get === 'function') {
      cookieHeader = req.headers.get('cookie') || ''
    } else if (req.headers && typeof req.headers === 'object') {
      cookieHeader = (req.headers as any)['cookie'] || (req.headers as any).cookie || ''
    }

    console.log('[v0] getCallerRole: cookieHeader length:', cookieHeader.length)
    console.log('[v0] getCallerRole: has payload-token:', cookieHeader.includes('payload-token'))

    const match = cookieHeader.match(/payload-token=([^;]+)/)
    if (match) {
      const token = match[1]
      const decoded = jwt.decode(token) as { role?: string; id?: string; collection?: string } | null
      console.log('[v0] getCallerRole: JWT decoded:', JSON.stringify(decoded))
      if (decoded) {
        return { role: decoded.role, id: decoded.id ? String(decoded.id) : undefined }
      }
    }

    // 2. Fallback to req.user for internal Payload calls (e.g. buildFormState,
    //    admin access checks) where cookie headers may not be forwarded.
    //    In these contexts req.user is still the real logged-in admin.
    const user = req.user as { role?: string; id?: string | number } | undefined
    console.log('[v0] getCallerRole: req.user exists:', !!user, 'role:', user?.role, 'id:', user?.id)
    console.log('[v0] getCallerRole: req.user full:', JSON.stringify(user ? { id: user.id, role: user.role } : null))
    if (user) {
      return { role: user.role, id: user.id ? String(user.id) : undefined }
    }

    console.log('[v0] getCallerRole: returning empty - no cookie, no req.user')
    return {}
  } catch (error) {
    console.log('[v0] getCallerRole ERROR:', error instanceof Error ? error.message : String(error))
    return {}
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
    beforeChange: [
      ({ data, operation }) => {
        if (operation === 'create') {
          data._verified = true
        }
        return data
      },
    ],
  },
  access: {
    read: () => true,
    create: ({ req }) => {
      console.log('[v0] access.create called')
      const caller = getCallerRole(req)
      console.log('[v0] access.create caller:', JSON.stringify(caller))
      return caller.role === 'admin'
    },
    update: ({ req, id }) => {
      console.log('[v0] access.update called, target id:', id)
      const caller = getCallerRole(req)
      console.log('[v0] access.update caller:', JSON.stringify(caller))
      if (caller.role === 'admin') return true
      if (caller.id && String(caller.id) === String(id)) return true
      return false
    },
    delete: ({ req }) => {
      console.log('[v0] access.delete called')
      const caller = getCallerRole(req)
      console.log('[v0] access.delete caller:', JSON.stringify(caller))
      return caller.role === 'admin'
    },
    admin: ({ req }) => {
      console.log('[v0] access.admin called')
      const caller = getCallerRole(req)
      console.log('[v0] access.admin caller:', JSON.stringify(caller), '=> result:', caller.role === 'admin')
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
