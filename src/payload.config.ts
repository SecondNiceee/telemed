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
})
