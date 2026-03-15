import type { CollectionConfig, PayloadRequest } from 'payload'
import { CATEGORIES_CACHE_TAG } from '@/lib/api/categories'
import { getCallerFromRequest } from './helpers/auth'

// Safe wrapper for revalidateTag that works in build time
const revalidateCategories = async () => {
  try {
    const { revalidateTag } = await import('next/cache')
    revalidateTag(CATEGORIES_CACHE_TAG)
  } catch {
    // revalidateTag is only available in Server Component context
  }
}

/**
 * Populate req.user from the organisations cookie (organisations-token) without a DB query.
 * JWT already contains id, email, collection -- enough for all access checks.
 */


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
      const caller = getCallerFromRequest(req, 'organisations')
      return caller?.role === 'admin' || caller?.collection === 'organisations'
    },
    update: ({ req }) => {
      const caller = getCallerFromRequest(req, 'organisations')
      return caller?.role === 'admin'
    },
    delete: ({ req }) => {
      const caller = getCallerFromRequest(req, 'organisations')
      return caller?.role === 'admin'
    },
  },
  hooks: {
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
    {
      name: 'iconImage',
      type: 'upload',
      relationTo: 'media',
      label: 'Изображение иконки',
      admin: {
        description: 'Загрузите собственное изображение иконки (PNG/SVG/JPG)',
      },
    },
  ],
}
