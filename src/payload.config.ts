import { postgresAdapter } from '@payloadcms/db-postgres'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Doctors } from './collections/Doctors'
import { Organisations } from './collections/Organisations'
import { Media } from './collections/Media'
import { DoctorCategories } from './collections/DoctorCategories'
import { Appointments } from './collections/Appointments'
import { Messages } from './collections/Messages'
import { CallRecordings } from './collections/CallRecordings'
import { Feedbacks } from './collections/Feedbacks'
import { SiteSettings } from './globals/SiteSettings'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  serverURL : process.env.SERVER_URL,
  
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },

  // /admin — наша собственная панель (src/app/(frontend)/admin).
  // Полная админка Payload остаётся на /cms как резервный инструмент.
  routes: {
    admin: '/cms',
  },

  collections: [Users, Doctors, Organisations, Media, DoctorCategories, Appointments, Messages, CallRecordings, Feedbacks],
  globals: [SiteSettings],
  editor: lexicalEditor(),
  email: nodemailerAdapter({
    defaultFromAddress: process.env.SMTP_FROM || 'no-reply@example.com',
    defaultFromName: process.env.SMTP_FROM_NAME || 'Telemed',
    transportOptions: {
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },

    },
  }),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
  }),
  sharp,
  plugins: [],

  /**
   * Запуск фонового освобождения просроченных броней.
   *
   * onInit вызывается один раз на процесс — при первой инициализации Payload
   * (`getPayload({ config })`), то есть на долгоживущем сервере (`next start`
   * под pm2/systemd/docker) ровно один раз. Это единственное место, откуда
   * sweeper реально стартует: страницы `/lk` и `/doctor/[id]` sweep намеренно
   * не делают (см. комментарии в `src/lib/server/appointment-holds.ts`), поэтому
   * без этого хука неоплаченная бронь навсегда оставалась в `pending_payment`,
   * а слот не возвращался в расписание врача.
   *
   * Почему не instrumentation.ts (как предполагали комментарии в коде):
   * Next компилирует instrumentation ещё и для edge-рантайма, где `payload`
   * (из-за node:crypto) не резолвится — сборка падает с
   * «Module not found: Can't resolve 'crypto'» даже при динамическом импорте
   * под проверкой NEXT_RUNTIME.
   */
  onInit: async () => {
    // Во время production-сборки Payload тоже инициализируется (пререндер
    // страниц) — фоновый таймер там не нужен.
    if (process.env.NEXT_PHASE === 'phase-production-build') return

    // Аварийный выключатель на случай отладки на VPS.
    if (process.env.DISABLE_HOLDS_SWEEPER === 'true') return

    try {
      // Динамический импорт: appointment-holds сам импортирует этот конфиг,
      // статический импорт дал бы цикл на этапе загрузки модуля.
      const { startExpiredHoldsSweeper } = await import('./lib/server/appointment-holds')
      const stop = startExpiredHoldsSweeper()

      console.log('[holds-sweeper] started')

      process.once('SIGTERM', stop)
      process.once('SIGINT', stop)
    } catch (err) {
      console.error('[holds-sweeper] failed to start:', err)
    }
  },
})
