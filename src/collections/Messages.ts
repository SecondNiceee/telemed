import type { CollectionConfig, PayloadRequest } from 'payload'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCallerFromRequest } from './helpers/auth'
import { buildAppointmentAccessFilter } from '@/utils/buildAppointmentAccessFilter'

export const Messages: CollectionConfig = {
  slug: 'messages',
  defaultSort: '-createdAt',
  admin: {
    useAsTitle: 'text',
    defaultColumns: ['appointment', 'sender', 'text', 'createdAt'],
    group: 'Чат',
  },
  access: {
    read: async ({ req }: { req: PayloadRequest }) => {
      // Admin can read all
      const callerAsUser = getCallerFromRequest(req, 'users')
      if (callerAsUser?.role === 'admin') return true

      // Check all tokens and build filter
      const callerAsDoctor = getCallerFromRequest(req, 'doctors')
      const callerAsOrg = getCallerFromRequest(req, 'organisations')
      
      const userId = callerAsUser?.collection === 'users' && callerAsUser.id 
        ? Number(callerAsUser.id) 
        : null
      const doctorId = callerAsDoctor?.collection === 'doctors' && callerAsDoctor.id 
        ? Number(callerAsDoctor.id) 
        : null

      // Get doctor IDs for organisation
      let doctorIds: number[] | null = null
      if (callerAsOrg?.collection === 'organisations' && callerAsOrg.id) {
        const payload = await getPayload({ config })
        const doctors = await payload.find({
          collection: 'doctors',
          where: { organisation: { equals: Number(callerAsOrg.id) } },
          limit: 1000,
          depth: 0,
        })
        doctorIds = doctors.docs.map(d => d.id)
      }

      return buildAppointmentAccessFilter(userId, doctorId, doctorIds)
    },
    create: ({ req }) => {
      // Users and doctors can create messages
      const callerAsUser = getCallerFromRequest(req, 'users')
      if (callerAsUser?.collection === 'users' && callerAsUser.id) return true

      const callerAsDoctor = getCallerFromRequest(req, 'doctors')
      if (callerAsDoctor?.collection === 'doctors' && callerAsDoctor.id) return true

      return false
    },
    update: async ({ req }) => {
      // Only admin can update messages (e.g., mark as read)
      const callerAsUser = getCallerFromRequest(req, 'users')
      if (callerAsUser?.role === 'admin') return true

      // Check all tokens and build filter
      const callerAsDoctor = getCallerFromRequest(req, 'doctors')
      const callerAsOrg = getCallerFromRequest(req, 'organisations')
      
      const userId = callerAsUser?.collection === 'users' && callerAsUser.id 
        ? Number(callerAsUser.id) 
        : null
      const doctorId = callerAsDoctor?.collection === 'doctors' && callerAsDoctor.id 
        ? Number(callerAsDoctor.id) 
        : null

      // Get doctor IDs for organisation
      let doctorIds: number[] | null = null
      if (callerAsOrg?.collection === 'organisations' && callerAsOrg.id) {
        const payload = await getPayload({ config })
        const doctors = await payload.find({
          collection: 'doctors',
          where: { organisation: { equals: Number(callerAsOrg.id) } },
          limit: 1000,
          depth: 0,
        })
        doctorIds = doctors.docs.map(d => d.id)
      }

      return buildAppointmentAccessFilter(userId, doctorId, doctorIds)
    },
    delete: ({ req }) => {
      const caller = getCallerFromRequest(req, 'users')
      return caller?.role === 'admin'
    },
    admin: () => true,
  },
  hooks: {}, // Я всё равно валидирую на socket сервере, тут ничего не нужно.
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
      name: 'sender',
      type: 'relationship',
      relationTo: ['users', 'doctors'],
      required: false,
      label: 'Отправитель',
      index: true,
      admin: {
        description: 'Полиморфная связь: может быть пользователем или врачом. Для системных сообщений = null',
      },
    },
    {
      name: 'isSystemMessage',
      type: 'checkbox',
      defaultValue: false,
      label: 'Системное сообщение',
      admin: {
        description: 'Если включено, сообщение отображается как системное уведомление',
      },
    },
    {
      name: 'text',
      type: 'textarea',
      required: false,
      label: 'Текст сообщения',
    },
    {
      name: 'attachment',
      type: 'upload',
      relationTo: 'media',
      required: false,
      label: 'Прикрепленный файл',
    },
    {
      name: 'read',
      type: 'checkbox',
      defaultValue: false,
      label: 'Прочитано',
    },
  ],
  timestamps: true,
}
