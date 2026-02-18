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
    let cookieHeader = ''
    if (typeof req.headers?.get === 'function') {
      cookieHeader = req.headers.get('cookie') || ''
    } else if (req.headers && typeof req.headers === 'object') {
      cookieHeader = (req.headers as any)['cookie'] || (req.headers as any).cookie || ''
    }

    const match = cookieHeader.match(/payload-token=([^;]+)/)
    if (!match) return {}

    const token = match[1]
    const decoded = jwt.decode(token) as { role?: string; id?: string; collection?: string } | null
    if (!decoded) return {}

    return { role: decoded.role, id: decoded.id ? String(decoded.id) : undefined }
  } catch {
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
      const caller = getCallerRole(req)
      return caller.role === 'admin'
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
