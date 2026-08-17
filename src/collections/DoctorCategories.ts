import type { CollectionConfig, PayloadRequest } from 'payload'
import { getCallerFromRequest } from './helpers/auth'

// NOTE: intentionally NOT imported from '@/lib/api/categories'.
// That module is part of the browser API client (it references File/FormData),
// and pulling it into the Payload config drags the whole client bundle into the
// server config graph, which can break at import time.
// Keep this literal in sync with CATEGORIES_CACHE_TAG in src/lib/api/categories.ts.
const CATEGORIES_CACHE_TAG = 'categories'

// Safe wrapper for revalidateTag that works in build time.
// IMPORTANT: must be awaited by callers — an unawaited rejection here
// becomes an unhandled promise rejection and can abort the whole request
// (the client then sees a bare "Failed to fetch" with no server log).
const revalidateCategories = async () => {
  try {
    const { revalidateTag } = await import('next/cache')
    revalidateTag(CATEGORIES_CACHE_TAG)
  } catch (err) {
    // revalidateTag is only available in Server Component / request context
    console.warn(
      '[doctor-categories] revalidateTag skipped:',
      err instanceof Error ? err.message : err,
    )
  }
}

const adminOnly = ({ req }: { req: PayloadRequest }) => {
  const usersCaller = getCallerFromRequest(req, 'users')
  return usersCaller?.role === 'admin'
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
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly
  },
  hooks: {
    afterChange: [
      async ({ doc, operation }) => {
        console.log('[doctor-categories] afterChange', {
          operation,
          id: (doc as { id?: number | string })?.id,
        })
        await revalidateCategories()
      },
    ],
    afterDelete: [
      async ({ id }) => {
        console.log('[doctor-categories] afterDelete', { id })
        await revalidateCategories()
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
