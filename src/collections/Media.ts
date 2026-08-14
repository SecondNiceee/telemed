import type { CollectionConfig, PayloadRequest } from 'payload'
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
    read: () => true,
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
    mimeTypes: ['image/*', 'video/*', 'audio/*', 'application/pdf'],
    filesRequiredOnCreate: false,
  },
}
