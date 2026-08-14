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


/** Поле upload приходит либо id, либо уже подтянутым документом. */
function toMediaId(value: unknown): number | string | null {
  if (typeof value === 'number' || typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: number | string }).id
    return id ?? null
  }
  return null
}

/**
 * Удаляет media-документы, на которые больше не ссылается ни один врач.
 *
 * Так пара «обрезанное + исходное» уходит целиком, когда фото заменили или
 * удалили, и в media не остаётся мусорных дублей. Проверка ссылок обязательна:
 * коллекция media общая (там же вложения чатов), а один и тот же файл мог
 * оказаться у двух врачей.
 */
async function deleteOrphanedMedia({
  req,
  ids,
}: {
  req: PayloadRequest
  ids: (number | string)[]
}) {
  const unique = [...new Set(ids.filter((id) => id != null))]
  if (unique.length === 0) return

  for (const id of unique) {
    try {
      // Без user и с overrideAccess по умолчанию: это внутренняя уборка,
      // она не должна зависеть от прав того, кто правил врача.
      const stillUsed = await req.payload.find({
        collection: 'doctors',
        where: {
          or: [{ photo: { equals: id } }, { photoOriginal: { equals: id } }],
        },
        limit: 1,
        depth: 0,
        req,
      })
      if (stillUsed.totalDocs > 0) continue

      await req.payload.delete({ collection: 'media', id, req })
    } catch (error) {
      // Осиротевший файл — не причина ронять уже успешное сохранение врача.
      console.error('[doctors] failed to delete orphaned media', {
        id,
        error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      })
    }
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
      // Фото заменили или сняли — старые файлы больше никому не нужны.
      // Именно afterChange, чтобы удалять только после успешного сохранения.
      async ({ doc, previousDoc, operation, req }) => {
        if (operation !== 'update' || !previousDoc) return

        const orphaned: (number | string)[] = []
        for (const field of ['photo', 'photoOriginal'] as const) {
          const before = toMediaId((previousDoc as Record<string, unknown>)[field])
          const after = toMediaId((doc as Record<string, unknown>)[field])
          if (before != null && String(before) !== String(after)) orphaned.push(before)
        }

        await deleteOrphanedMedia({ req, ids: orphaned })
      },
    ],
    afterDelete: [
      () => {
        revalidateDoctorsCache()
      },
      // Врача удалили — его фото тоже.
      async ({ doc, req }) => {
        const record = doc as Record<string, unknown>
        await deleteOrphanedMedia({
          req,
          ids: [toMediaId(record.photo), toMediaId(record.photoOriginal)].filter(
            (id): id is number | string => id != null,
          ),
        })
      },
    ],
    beforeChange: [],
  },
  access: {
    read: () => true,
    create: ({ req }) => {
      // Organisation creates doctors; admin can too
      const user = getCallerFromRequest(req, "users");
      if (user?.role === "admin") return true;
      const organistion = getCallerFromRequest(req, 'organisations');
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
      label: 'Специальности',
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
      admin: {
        description:
          'Обрезанный квадрат — именно он показывается во всём приложении. Не меняйте вручную: загружайте фото через кабинет организации.',
      },
    },
    {
      name: 'photoOriginal',
      type: 'upload',
      relationTo: 'media',
      label: 'Исходное фото',
      admin: {
        description:
          'Необрезанный оригинал. Нигде не показывается, нужен только чтобы позже заново выбрать область.',
      },
    },
    {
      name: 'photoCrop',
      type: 'group',
      label: 'Выбранная область',
      admin: {
        description:
          'Координаты в пикселях исходного фото. Заполняется автоматически, чтобы редактор открывал рамку там, где её оставили.',
      },
      fields: [
        { name: 'x', type: 'number', label: 'X' },
        { name: 'y', type: 'number', label: 'Y' },
        { name: 'side', type: 'number', label: 'Сторона' },
      ],
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
