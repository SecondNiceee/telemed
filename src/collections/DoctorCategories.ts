import type { CollectionConfig } from 'payload'
import { revalidateTag } from 'next/cache'
import { CATEGORIES_CACHE_TAG } from '@/lib/api/categories'
import { getCallerFromRequest } from './helpers/auth'

const revalidateCategories = () => {
  revalidateTag(CATEGORIES_CACHE_TAG)
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
    create: ({ req }) => getCallerFromRequest(req).role === 'admin',
    update: ({ req }) => getCallerFromRequest(req).role === 'admin',
    delete: ({ req }) => getCallerFromRequest(req).role === 'admin',
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
  ],
}
