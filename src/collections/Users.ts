import type { CollectionConfig, PayloadRequest } from 'payload'
import { getCallerFromRequest, decodeUsersCookie } from './helpers/auth'

/**
 * Populate req.user from the users cookie (payload-token) without a DB query.
 * JWT already contains id, role, email, collection -- enough for all access checks.
 */
function ensureReqUser({
  req,
}: {
  req: PayloadRequest
  operation: string
}) {
  if (req.user) return

  const decoded = decodeUsersCookie(req)
  if (!decoded?.id) return

  req.user = {
    id: decoded.id,
    email: decoded.email,
    role: decoded.role,
    collection: decoded.collection,
  } as unknown as PayloadRequest['user']
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
      const caller = getCallerFromRequest(req, 'users')
      return caller?.role === 'admin'
    },
    update: ({ req, id }) => {
      const caller = getCallerFromRequest(req, 'users')
      if (caller?.role === 'admin') return true
      if (caller?.id && String(caller.id) === String(id)) return true
      return false
    },
    delete: ({ req }) => {
      const caller = getCallerFromRequest(req, 'users')
      return caller?.role === 'admin'
    },
    admin: ({ req }) => {
      const caller = getCallerFromRequest(req, 'users')
      return caller?.role === 'admin'
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
  ],
}
