import type { CollectionConfig, PayloadRequest } from 'payload'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCallerFromRequest } from './helpers/auth'

export const CallRecordings: CollectionConfig = {
  slug: 'call-recordings',
  labels: {
    singular: 'Запись звонка',
    plural: 'Записи звонков',
  },
  access: {
    read: async ({ req }: { req: PayloadRequest }) => {
      // Admin can read all
      const callerAsUser = getCallerFromRequest(req, 'users')
      if (callerAsUser?.role === 'admin') return true

      // Doctor can read their own recordings
      const callerAsDoctor = getCallerFromRequest(req, 'doctors')
      if (callerAsDoctor?.collection === 'doctors' && callerAsDoctor.id) {
        return { doctor: { equals: Number(callerAsDoctor.id) } }
      }

      // Organisation can read recordings from their doctors
      const callerAsOrg = getCallerFromRequest(req, 'organisations')
      if (callerAsOrg?.collection === 'organisations' && callerAsOrg.id) {
        const payload = await getPayload({ config })
        const doctors = await payload.find({
          collection: 'doctors',
          where: { organisation: { equals: Number(callerAsOrg.id) } },
          limit: 1000,
          depth: 0,
        })
        const doctorIds = doctors.docs.map(d => d.id)
        if (doctorIds.length > 0) {
          return { doctor: { in: doctorIds } }
        }
      }

      return false
    },
    create: ({ req }: { req: PayloadRequest }) => {
      // Only doctors can create recordings
      const callerAsDoctor = getCallerFromRequest(req, 'doctors')
      if (callerAsDoctor?.collection === 'doctors') return true
      
      // Admin can also create
      const callerAsUser = getCallerFromRequest(req, 'users')
      if (callerAsUser?.role === 'admin') return true

      return false
    },
    update: ({ req }: { req: PayloadRequest }) => {
      // Admin only
      const callerAsUser = getCallerFromRequest(req, 'users')
      if (callerAsUser?.role === 'admin') return true
      return false
    },
    delete: ({ req }: { req: PayloadRequest }) => {
      // Admin only
      const callerAsUser = getCallerFromRequest(req, 'users')
      if (callerAsUser?.role === 'admin') return true
      return false
    },
  },
  fields: [
    {
      name: 'appointment',
      type: 'relationship',
      relationTo: 'appointments',
      required: true,
      label: 'Консультация',
      index: true,
    },
    {
      name: 'doctor',
      type: 'relationship',
      relationTo: 'doctors',
      required: true,
      label: 'Врач',
      index: true,
    },
    {
      name: 'recordingType',
      type: 'select',
      label: 'Тип записи',
      defaultValue: 'video',
      options: [
        { label: 'Видео', value: 'video' },
        { label: 'Аудио', value: 'audio' },
      ],
      index: true,
    },
    {
      name: 'video',
      type: 'upload',
      relationTo: 'media',
      required: true,
      label: 'Запись',
    },
    {
      name: 'durationSeconds',
      type: 'number',
      label: 'Длительность (сек)',
      min: 0,
    },
    {
      name: 'recordedAt',
      type: 'date',
      label: 'Дата записи',
      defaultValue: () => new Date().toISOString(),
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
  ],
  timestamps: true,
}
