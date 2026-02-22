import type { CollectionConfig, PayloadRequest } from 'payload'
import { getCallerFromRequest, decodeUsersCookie } from './helpers/auth'

/**
 * Populate req.user ONLY from the users cookie (payload-token).
 * This ensures that org/doctor cookies never override the admin user
 * in the Payload Admin Panel.
 */
async function ensureReqUser({
  req,
}: {
  req: PayloadRequest
  operation: string
}) {
  if (req.user) return

  const decoded = decodeUsersCookie(req)
  if (!decoded?.id) return

  try {
    const user = await req.payload.findByID({
      collection: decoded.collection,
      id: decoded.id,
      depth: 0,
      overrideAccess: true,
    })

    if (user) {
      req.user = { ...user, collection: decoded.collection } as any
    }
  } catch {
    // silently fail
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
      const caller = getCallerFromRequest(req)
      return caller.role === 'admin'
    },
    update: ({ req, id }) => {
      const caller = getCallerFromRequest(req)
      if (caller.role === 'admin') return true
      if (caller.id && String(caller.id) === String(id)) return true
      return false
    },
    delete: ({ req }) => {
      const caller = getCallerFromRequest(req)
      return caller.role === 'admin'
    },
    admin: ({ req }) => {
      const caller = getCallerFromRequest(req)
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
