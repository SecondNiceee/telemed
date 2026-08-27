import type { CollectionConfig, PayloadRequest, Where } from 'payload'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCallerFromRequest } from './helpers/auth';
import { MEDIA_DIR, ensureMediaDir } from '@/lib/media-dir'

// Create the upload folder as soon as the config loads, so a missing `media/`
// directory (or wrong owner) is visible in the boot log instead of breaking
// the first upload.
ensureMediaDir()

const checkAccessCookie = ({req} : {req:PayloadRequest}) => {
  const user = getCallerFromRequest(req, "users");
  if (user?.role === "admin") return true;
  // Allow regular users to upload files (for chat attachments)
  if (user?.collection === "users") return true;
  const organisation = getCallerFromRequest(req, "organisations");
  if (organisation?.collection === "organisations") return true;
  const doctor = getCallerFromRequest(req, 'doctors');
  if (doctor?.collection === "doctors") return true;

  console.error('[media] access DENIED — no recognised caller cookie', {
    hasCookieHeader: Boolean(req?.headers?.get?.('cookie')),
  })
  return false 
}

/**
 * Условие «файл публичный».
 *
 * Документы, загруженные до появления поля visibility, значения не имеют
 * вовсе, и запрос `visibility = public` их бы отбросил - каталог врачей
 * мгновенно остался бы без фотографий. Поэтому отсутствие поля равносильно
 * «публичный»: это сохраняет работу сайта на текущих данных.
 *
 * Обратная сторона: уже загруженные записи консультаций тоже попадают под это
 * правило. Их нужно один раз пометить приватными скриптом
 * scripts/backfill-media-visibility.ts - до этого старые записи остаются
 * открытыми.
 */
const PUBLIC_FILE_CONDITIONS: Where[] = [
  { visibility: { equals: 'public' } },
  { visibility: { exists: false } },
]

/** Публичное + личное: свои приватные файлы поверх общедоступных. */
const withOwnFiles = (own: Where): Where => ({ or: [...PUBLIC_FILE_CONDITIONS, own] })

/**
 * Кто какие файлы может читать.
 *
 * Правило возвращает не true/false, а условие выборки: так Payload применяет
 * его и к отдаче самого файла, и к списку /api/media. Второе важнее всего -
 * при `read: () => true` любой желающий мог получить список всех документов с
 * именами файлов, и случайные имена перестали защищать записи приёмов.
 */
const readAccess = async ({ req }: { req: PayloadRequest }): Promise<boolean | Where> => {
  const user = getCallerFromRequest(req, 'users')
  if (user?.role === 'admin') return true

  // Пациент: общедоступные файлы плюс те, где он указан явно (его записи
  // консультаций и вложения его чатов).
  if (user?.collection === 'users' && user.id != null) {
    return withOwnFiles({ allowedUser: { equals: Number(user.id) } })
  }

  const doctor = getCallerFromRequest(req, 'doctors')
  if (doctor?.collection === 'doctors' && doctor.id != null) {
    return withOwnFiles({ allowedDoctor: { equals: Number(doctor.id) } })
  }

  // Организация видит файлы своих врачей - так же, как в call-recordings.
  const organisation = getCallerFromRequest(req, 'organisations')
  if (organisation?.collection === 'organisations' && organisation.id != null) {
    try {
      const payload = await getPayload({ config })
      const doctors = await payload.find({
        collection: 'doctors',
        where: { organisation: { equals: Number(organisation.id) } },
        limit: 1000,
        depth: 0,
        overrideAccess: true,
      })
      const doctorIds = doctors.docs.map((d) => d.id)
      if (doctorIds.length > 0) {
        return withOwnFiles({ allowedDoctor: { in: doctorIds } })
      }
    } catch (error) {
      // Упасть здесь нельзя: тогда у организации пропадут и обычные картинки.
      console.error('[media] Не удалось получить врачей организации', {
        organisationId: organisation.id,
        error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      })
    }
  }

  // Анонимный посетитель и все прочие: только публичные файлы.
  return { or: PUBLIC_FILE_CONDITIONS }
}

/**
 * Делает имя файла глобально уникальным ещё до записи на диск.
 *
 * Payload сам умеет разруливать дубли (kate.jpg -> kate-1.jpg), но делает это
 * проверкой «есть ли уже такой файл/документ» прямо перед записью. Между
 * проверкой и записью есть окно: два параллельных запроса с одинаковым именем
 * (у нас формы врача грузят сразу пару файлов, плюс вложения чатов) могут
 * получить одно и то же имя и указать на ОДИН файл на диске. Тогда удаление
 * одного media-документа физически сносит фото и у второго врача.
 *
 * Поэтому имя формируем сами: читаемая основа + время + случайный суффикс.
 * Коллизия становится невозможной, и проверка Payload просто не срабатывает.
 */
function makeFilenameUnique({
  operation,
  req,
}: {
  operation: string
  req: PayloadRequest
}) {
  if (operation !== 'create' && operation !== 'update') return

  const file = (req as unknown as { file?: { name?: string } }).file
  if (!file?.name) return

  const dot = file.name.lastIndexOf('.')
  const rawBase = dot > 0 ? file.name.slice(0, dot) : file.name
  const ext = dot > 0 ? file.name.slice(dot + 1).toLowerCase() : ''

  // Транслитерация не нужна — важно лишь получить безопасную читаемую основу.
  const base =
    rawBase
      .toLowerCase()
      .replace(/[^a-z0-9а-яё]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'file'

  const unique = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  file.name = ext ? `${base}-${unique}.${ext}` : `${base}-${unique}`
}

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: readAccess,
    create: checkAccessCookie,
    update: checkAccessCookie,
    delete: checkAccessCookie
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: false,
    },
    {
      name: 'visibility',
      type: 'select',
      label: 'Доступность файла',
      // По умолчанию публичный: подавляющая часть загрузок - это фото врачей
      // и иконки категорий, которые обязаны открываться без входа.
      // Приватность выставляется явно там, где создаётся запись консультации
      // или вложение чата.
      defaultValue: 'public',
      index: true,
      options: [
        { label: 'Публичный (каталог, фото врачей)', value: 'public' },
        { label: 'Приватный (записи приёмов, вложения чатов)', value: 'private' },
      ],
    },
    {
      name: 'allowedUser',
      type: 'relationship',
      relationTo: 'users',
      label: 'Пациент с доступом',
      index: true,
      admin: {
        description: 'Заполняется автоматически для приватных файлов.',
        condition: (data) => data?.visibility === 'private',
      },
    },
    {
      name: 'allowedDoctor',
      type: 'relationship',
      relationTo: 'doctors',
      label: 'Врач с доступом',
      index: true,
      admin: {
        description: 'Заполняется автоматически для приватных файлов.',
        condition: (data) => data?.visibility === 'private',
      },
    },
  ],
  hooks: {
    beforeOperation: [
      // Первым: дальше в логах и на диске должно быть уже уникальное имя.
      makeFilenameUnique,
      ({ operation, req }) => {
        if (operation === 'create') {
          const file = (req as unknown as { file?: { name?: string; mimetype?: string; size?: number } }).file
          console.log('[media] create incoming', {
            filename: file?.name,
            mimeType: file?.mimetype,
            size: file?.size,
          })
        }
      },
    ],
    afterError: [
      ({ error }) => {
        // Filesystem problems (ENOENT/EACCES/ENOSPC while writing to staticDir)
        // otherwise surface on the client as a bare "Failed to fetch".
        console.error('[media] operation failed', {
          dir: MEDIA_DIR,
          cwd: process.cwd(),
          error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
        })
      },
    ],
    afterChange: [
      ({ doc, operation }) => {
        const d = doc as unknown as { id?: number | string; filename?: string; mimeType?: string; filesize?: number }
        console.log('[media] afterChange', {
          operation,
          id: d?.id,
          filename: d?.filename,
          mimeType: d?.mimeType,
          filesize: d?.filesize,
        })
      },
    ],
  },
  upload: {
    // MUST be absolute: Payload resolves a relative staticDir against
    // process.cwd(), which is not stable between `next dev`, `next start`,
    // standalone output and PM2/systemd working directories.
    staticDir: MEDIA_DIR,
    mimeTypes: [
      'image/*',
      'video/*',
      'audio/*',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/rtf',
      'application/vnd.oasis.opendocument.text',
      'application/vnd.oasis.opendocument.presentation',
      'application/vnd.oasis.opendocument.spreadsheet',
      'application/zip',
      'application/x-7z-compressed',
      'text/plain',
      'text/csv',
    ],
    filesRequiredOnCreate: false,
  },
}
