import type { CollectionConfig, PayloadRequest } from 'payload'
import { getCallerFromRequest, decodeAnyCookie } from './helpers/auth'

/**
 * Populate req.user from any of the 3 auth cookies when Payload
 * fails to do so (e.g. during buildFormState Server Actions).
 */
async function ensureReqUser({
  req,
}: {
  req: PayloadRequest
  operation: string
}) {
  if (req.user) return

  const decoded = decodeAnyCookie(req)
  if (!decoded?.id || !decoded?.collection) return

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

export const Organisations: CollectionConfig = {
  slug: 'organisations',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email'],
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
      // Organisation can update itself
      if (caller.collection === 'organisations' && caller.id && String(caller.id) === String(id)) return true
      return false
    },
    delete: ({ req }) => {
      const caller = getCallerFromRequest(req)
      return caller.role === 'admin'
    },
    admin: () => false, // Organisations don't access Payload Admin Panel
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Название организации',
      required: true,
    },
  ],
}
