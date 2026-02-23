import type { CollectionConfig, PayloadRequest } from 'payload'
import { revalidateTag } from 'next/cache'
import { DOCTORS_CACHE_TAG } from '@/lib/api/doctors'
import { getCallerFromRequest, decodeSpecificCookie } from './helpers/auth'


/**
 * Populate req.user from the doctors cookie (doctors-token) without a DB query.
 * JWT already contains id, email, collection -- enough for all access checks.
 */
function ensureReqUser({
  req,
}: {
  req: PayloadRequest
  operation: string
}) {
  if (req.user) return

  const decoded = decodeSpecificCookie(req, 'doctors-token', 'doctors')
  if (!decoded?.id) return

  req.user = {
    id: decoded.id,
    email: decoded.email,
    role: 'doctor',
    collection: decoded.collection,
  } as PayloadRequest['user']
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
      if (caller.role === 'admin') return true
      // Organisation can delete its own doctors
      if (caller.collection === 'organisations') return true
      return false
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
    {
      name: 'slotDuration',
      type: 'select',
      label: 'Длительность слота (мин)',
      defaultValue: '30',
      options: [
        { label: '15 минут', value: '15' },
        { label: '30 минут', value: '30' },
        { label: '45 минут', value: '45' },
        { label: '60 минут', value: '60' },
        { label: '90 минут', value: '90' },
      ],
      admin: {
        description: 'Длительность одной консультации',
      },
    },
    {
      name: 'schedule',
      type: 'array',
      label: 'Расписание по датам',
      admin: {
        description: 'Расписание на конкретные даты. Можно ставить на год вперед.',
      },
      fields: [
        {
          name: 'date',
          type: 'text',
          label: 'Дата',
          required: true,
          admin: {
            description: 'Формат YYYY-MM-DD',
          },
        },
        {
          name: 'slots',
          type: 'array',
          label: 'Временные слоты',
          fields: [
            {
              name: 'time',
              type: 'text',
              label: 'Время',
              required: true,
              admin: {
                description: 'Формат HH:MM, например 09:00',
              },
            },
          ],
        },
      ],
    },
  ],
}
