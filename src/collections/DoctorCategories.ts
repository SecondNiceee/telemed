import type { CollectionConfig, PayloadRequest } from 'payload'
import { revalidateTag } from 'next/cache'
import { CATEGORIES_CACHE_TAG } from '@/lib/api/categories'
import { getCallerFromRequest, decodeSpecificCookie } from './helpers/auth'

const revalidateCategories = () => {
  revalidateTag(CATEGORIES_CACHE_TAG)
}

/**
 * Populate req.user from the organisations cookie (organisations-token) without a DB query.
 * JWT already contains id, email, collection -- enough for all access checks.
 */
function ensureReqUser({
  req,
}: {
  req: PayloadRequest
  operation: string
}) {
  if (req.user) return

  const decoded = decodeSpecificCookie(req, 'organisations-token', 'organisations')
  if (!decoded?.id) return

  req.user = {
    id: decoded.id,
    email: decoded.email,
    role: 'organisation',
    collection: decoded.collection,
  } as unknown as PayloadRequest['user']
}

export const DoctorCategories: CollectionConfig = {
  slug: 'doctor-categories',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'description'],
    group: 'Контент',
  },
  access: {
    read: () => true,
    create: ({ req }) => {
      const caller = getCallerFromRequest(req)
      return caller.role === 'admin' || caller.collection === 'organisations'
    },
    update: ({ req }) => {
      const caller = getCallerFromRequest(req)
      return caller.role === 'admin'
    },
    delete: ({ req }) => {
      const caller = getCallerFromRequest(req)
      return caller.role === 'admin'
    },
  },
  hooks: {
    beforeOperation: [ensureReqUser],
    afterChange: [
      () => {
        revalidateCategories()
      },
    ],
    afterDelete: [
      () => {
        revalidateCategories()
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'Название',
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      label: 'Слаг (URL)',
      admin: {
        description: 'Уникальный идентификатор для URL (например: therapist)',
      },
    },
    {
      name: 'description',
      type: 'text',
      label: 'Описание',
    },
    {
      name: 'icon',
      type: 'text',
      label: 'Иконка (Lucide)',
      admin: {
        description: 'Название иконки из библиотеки Lucide (например: stethoscope, heart, brain)',
      },
    },
  ],
}
