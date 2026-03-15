import type { CollectionConfig, PayloadRequest } from 'payload'
import { DOCTORS_CACHE_TAG } from '@/lib/api/doctors'
import { DecodedCaller, getCallerFromRequest } from './helpers/auth'

// Safe wrapper for revalidateTag that works in build time
const revalidateDoctorsCache = async () => {
  try {
    const { revalidateTag } = await import('next/cache')
    revalidateTag(DOCTORS_CACHE_TAG)
  } catch {
    // revalidateTag is only available in Server Component context
  }
}


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

  const decoded = getCallerFromRequest(req, 'doctors') as DecodedCaller | null
  if (!decoded?.id) return

  req.user = {
    id: decoded.id,
    email: decoded.email,
    role: 'doctor',
    collection: decoded.collection,
  } as unknown as PayloadRequest['user']
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
        revalidateDoctorsCache()
      },
    ],
    afterDelete: [
      () => {
        revalidateDoctorsCache()
      },
    ],
    beforeChange: [],
  },
  access: {
    read: () => true,
    create: ({ req }) => {
      // Organisation creates doctors; admin can too
      console.log("Самое начало")
      const user = getCallerFromRequest(req, "users");
      console.log(user);
      if (user?.role === "admin") return true;
      const organistion = getCallerFromRequest(req, 'organisations');
      console.log("Я ТУТ")
      if (organistion?.collection === "organisations") return true;
      return false
    },
    update: ({ req, id }) => {
      // Admin
      const user = getCallerFromRequest(req, 'users')
      if (user?.role === 'admin') return true
      // Doctor updates themselves
      const doctor = getCallerFromRequest(req, 'doctors')
      if (doctor?.collection === 'doctors' && doctor.id && String(doctor.id) === String(id)) return true
      // Organisation updates its doctors
      const callerAsOrg = getCallerFromRequest(req, 'organisations')
      if (callerAsOrg?.collection === 'organisations') return true
      return false
    },
    delete: ({ req }) => {
      const callerAsUser = getCallerFromRequest(req, 'users')
      if (callerAsUser?.role === 'admin') return true
      const callerAsOrg = getCallerFromRequest(req, 'organisations')
      if (callerAsOrg?.collection === 'organisations') return true
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
