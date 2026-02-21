import type { CollectionConfig } from 'payload'
import { getCallerFromRequest } from './helpers/auth'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
    create: ({ req }) => {
      const caller = getCallerFromRequest(req)
      return caller.role === 'admin' || caller.collection === 'organisations'
    },
    update: ({ req }) => {
      const caller = getCallerFromRequest(req)
      return caller.role === 'admin' || caller.collection === 'organisations'
    },
    delete: ({ req }) => {
      const caller = getCallerFromRequest(req)
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
