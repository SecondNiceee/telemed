import type { CollectionBeforeOperationHook, CollectionConfig, PayloadRequest } from 'payload'
import { after } from 'next/server'
import { DOCTORS_CACHE_TAG } from '@/lib/api/doctors'
import { DecodedCaller, getCallerFromRequest } from './helpers/auth'
import {
  getScheduleSlotDate,
  isScheduleSlotFuture,
  SCHEDULE_SLOT_TOO_SOON_MESSAGE,
} from '@/lib/schedule-time'

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
 * Ждёт, пока изменение врача станет видно вне транзакции.
 *
 * Раньше здесь опрашивался req.transactionID, но это ненадёжный признак:
 * у вложенной операции id принадлежит родительской транзакции и не исчезает,
 * а если транзакций нет вовсе — id пуст с самого начала и ожидание проходит
 * мгновенно, ещё до коммита. Тогда проверка ссылок читала старое состояние,
 * видела живого врача с этим фото и молча пропускала файл (`continue`) — без
 * ретрая и без лога. Поэтому ждём не транзакцию, а сам результат: пока
 * `isCommitted` не подтвердит, что запись действительно изменилась в БД.
 *
 * Возвращает false, если за дедлайн подтверждения не случилось — значит
 * транзакция, скорее всего, откатилась и удалять media нельзя.
 */
async function waitForCommit(isCommitted: () => Promise<boolean>): Promise<boolean> {
  const DEADLINE_MS = 15_000
  const STEP_MS = 50
  const startedAt = Date.now()

  do {
    try {
      if (await isCommitted()) return true
    } catch {
      // Читаем БД снаружи транзакции: разрыв соединения или недоступность —
      // повод повторить попытку, а не считать коммит состоявшимся.
    }
    await new Promise((resolve) => setTimeout(resolve, STEP_MS))
  } while (Date.now() - startedAt < DEADLINE_MS)

  return false
}

/**
 * Удаляет media-документы, на которые больше не ссылается ни один врач.
 *
 * Так пара «обрезанное + исходное» уходит целиком, когда фото заменили или
 * удалили, и в media не остаётся мусорных дублей. Проверка ссылок обязательна:
 * коллекция media общая (там же вложения чатов), а один и тот же файл мог
 * оказаться у двух врачей.
 *
 * Работает строго ПОСЛЕ транзакции врача и без req, потому что:
 *  1. payload.delete у media сносит и файл с диска — внутри транзакции откат
 *     вернул бы строку в БД, но файл уже не восстановить, и фото стало бы
 *     битой ссылкой;
 *  2. в postgres ссылки doctors.photo/photoOriginal — это FK с ON DELETE SET
 *     NULL, поэтому удаление media из другой транзакции ждало бы блокировку на
 *     строке врача и повисло бы до таймаута.
 * Плюс проверка ссылок читает уже зафиксированные данные: если транзакция
 * откатилась, врач по-прежнему ссылается на файл и тот останется жив.
 */
async function deleteOrphanedMedia({
  req,
  ids,
  isCommitted,
}: {
  req: PayloadRequest
  ids: (number | string)[]
  /** Подтверждает, что изменение врача уже видно вне транзакции. */
  isCommitted: () => Promise<boolean>
}) {
  const unique = [...new Set(ids.filter((id) => id != null))]
  if (unique.length === 0) return

  const { payload } = req

  if (!(await waitForCommit(isCommitted))) {
    // Коммит не подтвердился: либо откат, либо БД недоступна. В обоих случаях
    // врач всё ещё может ссылаться на файл — удалять нельзя.
    console.warn('[doctors] media cleanup skipped: commit not confirmed', { ids: unique })
    return
  }

  for (const id of unique) {
    try {
      // Без user и req, с overrideAccess по умолчанию: это внутренняя уборка,
      // она не должна зависеть от прав того, кто правил врача. Отдельный req
      // ещё и обязателен — media удаляется вне транзакции врача.
      const stillUsed = await payload.find({
        collection: 'doctors',
        where: {
          or: [{ photo: { equals: id } }, { photoOriginal: { equals: id } }],
        },
        limit: 1,
        depth: 0,
      })

      // Один файл мог достаться двум врачам — тогда он ещё нужен.
      if (stillUsed.totalDocs > 0) {
        console.log('[doctors] media kept, still referenced', { id })
        continue
      }

      await payload.delete({ collection: 'media', id })
      console.log('[doctors] orphaned media deleted', { id })
    } catch (error) {
      // Осиротевший файл — не причина ронять уже успешное изменение врача.
      console.error('[doctors] failed to delete orphaned media', {
        id,
        error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      })
    }
  }
}

/**
 * Ставит уборку в очередь, не блокируя текущую операцию: ждать её внутри хука
 * нельзя — транзакция закрывается только после того, как хук вернёт управление.
 * after() держит serverless-функцию живой до конца уборки, а если контекста
 * запроса нет (локальный API, сиды, админка вне запроса) — просто отпускаем
 * промис.
 */
function scheduleOrphanedMediaCleanup(args: {
  req: PayloadRequest
  ids: (number | string)[]
  isCommitted: () => Promise<boolean>
}) {
  if (args.ids.length === 0) return

  const run = () => {
    // Ошибку внутри уборки глотать нельзя молча: floating promise без catch
    // в Node роняет процесс через unhandledRejection.
    void deleteOrphanedMedia(args).catch((error) => {
      console.error('[doctors] media cleanup crashed', {
        ids: args.ids,
        error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      })
    })
  }

  try {
    after(run)
  } catch {
    // Вне контекста запроса (локальный API, сиды, скрипты) after() кидает —
    // тогда просто отпускаем промис: уборка сама дождётся коммита.
    run()
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

/**
 * `photoCrop` — это group, и Payload обходит её подполя, беря их из объекта
 * группы. Проверка «это объект» сделана через typeof, а typeof null === 'object',
 * поэтому пришедший с клиента `photoCrop: null` не заменяется на {} — обход
 * падает на первом подполе с «Cannot read properties of null (reading 'x')»
 * и запрос отдаёт 500. Нормализуем до любых хуков и валидации: «области нет» —
 * это объект с пустыми полями, а не null.
 */
const normalisePhotoCrop: CollectionBeforeOperationHook = ({ args }) => {
  const data = (args as { data?: Record<string, unknown> })?.data
  if (data && data.photoCrop === null) {
    data.photoCrop = { x: null, y: null, side: null }
  }
  return args
}

function validateSchedule({ data }: { data?: Record<string, unknown> }) {
  if (!data || !Object.prototype.hasOwnProperty.call(data, 'schedule')) return data
  if (data.schedule == null) return data
  if (!Array.isArray(data.schedule)) throw new Error('Некорректный формат расписания')

  const now = new Date()
  for (const entry of data.schedule) {
    if (!entry || typeof entry !== 'object') throw new Error('Некорректный формат расписания')
    const { date, slots } = entry as { date?: unknown; slots?: unknown }
    if (typeof date !== 'string' || !Array.isArray(slots)) {
      throw new Error('Некорректный формат даты или слотов расписания')
    }

    for (const slot of slots) {
      const time = slot && typeof slot === 'object' ? (slot as { time?: unknown }).time : null
      if (typeof time !== 'string' || !getScheduleSlotDate(date, time)) {
        throw new Error(`Некорректные дата или время слота: ${date} ${String(time ?? '')}`)
      }
      if (!isScheduleSlotFuture(date, time, now)) {
        throw new Error(`${SCHEDULE_SLOT_TOO_SOON_MESSAGE}: ${date} ${time}`)
      }
    }
  }

  return data
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
    beforeOperation: [normalisePhotoCrop, ensureReqUser],
    afterChange: [
      () => {
        revalidateDoctorsCache()
      },
      // Фото заменили, переобрезали или сняли — старые файлы больше никому не
      // нужны. Именно afterChange: здесь уже виден итоговый doc, а сама уборка
      // ждёт закрытия транзакции, поэтому await тут не нужен и невозможен.
      ({ doc, previousDoc, operation, req }) => {
        if (operation !== 'update' || !previousDoc) return

        const orphaned: (number | string)[] = []
        for (const field of ['photo', 'photoOriginal'] as const) {
          const before = toMediaId((previousDoc as Record<string, unknown>)[field])
          const next = toMediaId((doc as Record<string, unknown>)[field])
          if (before != null && String(before) !== String(next)) orphaned.push(before)
        }

        // Коммит виден, когда у врача в БД уже стоит новая ссылка на фото.
        scheduleOrphanedMediaCleanup({
          req,
          ids: orphaned,
          isCommitted: async () => {
            const fresh = await req.payload.findByID({
              collection: 'doctors',
              id: (doc as { id: number | string }).id,
              depth: 0,
              disableErrors: true,
            })
            if (!fresh) return true // врача уже удалили — старые файлы точно осиротели
            const record = fresh as unknown as Record<string, unknown>
            return orphaned.every((id) => {
              return (
                String(toMediaId(record.photo)) !== String(id) &&
                String(toMediaId(record.photoOriginal)) !== String(id)
              )
            })
          },
        })
      },
    ],
    afterDelete: [
      () => {
        revalidateDoctorsCache()
      },
      // Врача удалили — его фото тоже.
      ({ doc, id, req }) => {
        const record = doc as Record<string, unknown>
        scheduleOrphanedMediaCleanup({
          req,
          ids: [toMediaId(record.photo), toMediaId(record.photoOriginal)].filter(
            (mediaId): mediaId is number | string => mediaId != null,
          ),
          // Коммит виден, когда врача больше нельзя прочитать из БД.
          isCommitted: async () => {
            const fresh = await req.payload.findByID({
              collection: 'doctors',
              id: id ?? (record.id as number | string),
              depth: 0,
              disableErrors: true,
            })
            return !fresh
          },
        })
      },
    ],
    beforeChange: [validateSchedule],
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
