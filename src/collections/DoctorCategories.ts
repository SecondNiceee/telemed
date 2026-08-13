import type { CollectionConfig, PayloadRequest } from 'payload'
import { CATEGORIES_CACHE_TAG } from '@/lib/api/categories'
import { getCallerFromRequest } from './helpers/auth'

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

const accessChecker = ({ req } : {req : PayloadRequest  }) => {
  const organizationCaller = getCallerFromRequest(req, 'organisations');
  const usersCaller = getCallerFromRequest(req, "users");
  if (organizationCaller.collection === "organisations") return true ;
  if (usersCaller.role  === "admin") return true;
  return false
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
    create:  accessChecker,
    update: accessChecker,
    delete: accessChecker
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
