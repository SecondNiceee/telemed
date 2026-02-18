import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
    create: ({ req }) => {
      const user = req.user as { role?: string } | undefined
      if (!user) return false
      return user.role === 'admin' || user.role === 'organisation'
    },
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
  ],
  upload: true,
}
