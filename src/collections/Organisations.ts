import type { CollectionConfig, PayloadRequest } from 'payload'
import { getCallerFromRequest, decodeSpecificCookie } from './helpers/auth'

/**
 * Populate req.user ONLY from the organisations cookie (organisations-token).
 * This ensures org hooks never accidentally adopt a user/doctor identity.
 */
async function ensureReqUser({
  req,
}: {
  req: PayloadRequest
  operation: string
}) {
  if (req.user) return

  const decoded = decodeSpecificCookie(req, 'organisations-token', 'organisations')
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
