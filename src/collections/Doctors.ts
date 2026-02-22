import type { CollectionConfig, PayloadRequest } from 'payload'
import { revalidateTag } from 'next/cache'
import { DOCTORS_CACHE_TAG } from '@/lib/api/doctors'
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

export const Doctors: CollectionConfig = {
  slug: 'doctors',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'organisation'],
    group: 'Пользователи',
  },
  auth: {
    verify: false,
    tokenExpiration: 60 * 60 * 24 * 7, // 7 days
  },
  hooks: {
    beforeOperation: [ensureReqUser],
    afterChange: [
      () => {
        revalidateTag(DOCTORS_CACHE_TAG)
      },
    ],
    afterDelete: [
      () => {
        revalidateTag(DOCTORS_CACHE_TAG)
      },
    ],
    beforeChange: [
      ({ data, operation, req }) => {
        if (operation === 'create') {
          data._verified = true

          // Auto-set organisation if the creator is an org
          const caller = getCallerFromRequest(req)
          if (caller.collection === 'organisations' && caller.id) {
            data.organisation = Number(caller.id)
          }
        }
        return data
      },
    ],
  },
  access: {
    read: () => true,
    create: ({ req }) => {
      const caller = getCallerFromRequest(req)
      console.log('[v0] Doctors.access.create caller:', JSON.stringify(caller))
      console.log('[v0] Doctors.access.create req.user:', req.user ? JSON.stringify({ id: (req.user as any).id, collection: (req.user as any).collection, role: (req.user as any).role }) : 'null')
      return caller.role === 'admin' || caller.collection === 'organisations'
    },
    update: ({ req, id }) => {
      const caller = getCallerFromRequest(req)
      if (caller.role === 'admin') return true
      // Doctor can update themselves
      if (caller.collection === 'doctors' && caller.id && String(caller.id) === String(id)) return true
      // Organisation can update its own doctors (handled via where query in practice)
      if (caller.collection === 'organisations') return true
      return false
    },
    delete: ({ req }) => {
      const caller = getCallerFromRequest(req)
      return caller.role === 'admin'
    },
    admin: () => false, // Doctors don't access Payload Admin Panel
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'ФИО',
    },
    {
      name: 'organisation',
      type: 'relationship',
      relationTo: 'organisations',
      required: true,
      label: 'Организация',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'categories',
      type: 'relationship',
      relationTo: 'doctor-categories',
      hasMany: true,
      label: 'Специализации',
    },
    {
      name: 'experience',
      type: 'number',
      label: 'Стаж (лет)',
    },
    {
      name: 'degree',
      type: 'text',
      label: 'Степень / Категория',
      admin: {
        description: 'Например: Врач высшей категории, Кандидат медицинских наук',
      },
    },
    {
      name: 'price',
      type: 'number',
      label: 'Цена консультации (руб.)',
    },
    {
      name: 'photo',
      type: 'upload',
      relationTo: 'media',
      label: 'Фото',
    },
    {
      name: 'bio',
      type: 'textarea',
      label: 'О враче',
    },
    {
      name: 'education',
      type: 'array',
      label: 'Образование',
      fields: [
        {
          name: 'value',
          type: 'text',
          label: 'Учебное заведение / Курс',
        },
      ],
    },
    {
      name: 'services',
      type: 'array',
      label: 'Услуги',
      fields: [
        {
          name: 'value',
          type: 'text',
          label: 'Название услуги',
        },
      ],
    },
  ],
}
