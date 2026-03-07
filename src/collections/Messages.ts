import type { CollectionConfig, PayloadRequest, Where } from 'payload'
import { getCallerFromRequest } from './helpers/auth'

export const Messages: CollectionConfig = {
  slug: 'messages',
  admin: {
    useAsTitle: 'text',
    defaultColumns: ['appointment', 'senderType', 'text', 'createdAt'],
    group: 'Чат',
  },
  access: {
    read: ({ req }: { req: PayloadRequest }) => {
      // Admin can read all
      const callerAsUser = getCallerFromRequest(req, 'users')
      if (callerAsUser?.role === 'admin') return true

      // Check both tokens and combine conditions with OR
      const callerAsDoctor = getCallerFromRequest(req, 'doctors')
      
      const conditions: Where[] = []

      // User reads messages from their appointments
      if (callerAsUser?.collection === 'users' && callerAsUser.id) {
        conditions.push({
          'appointment.user': { equals: Number(callerAsUser.id) },
        })
      }

      // Doctor reads messages from their appointments
      if (callerAsDoctor?.collection === 'doctors' && callerAsDoctor.id) {
        conditions.push({
          'appointment.doctor': { equals: Number(callerAsDoctor.id) },
        })
      }

      // Return combined OR query if we have conditions
      if (conditions.length > 0) {
        return conditions.length === 1 
          ? conditions[0] 
          : { or: conditions } as Where
      }

      return false
    },
    create: ({ req }) => {
      // Users and doctors can create messages
      const callerAsUser = getCallerFromRequest(req, 'users')
      if (callerAsUser?.collection === 'users' && callerAsUser.id) return true

      const callerAsDoctor = getCallerFromRequest(req, 'doctors')
      if (callerAsDoctor?.collection === 'doctors' && callerAsDoctor.id) return true

      return false
    },
    update: ({ req }) => {
      // Only admin can update messages (e.g., mark as read)
      const callerAsUser = getCallerFromRequest(req, 'users')
      if (callerAsUser?.role === 'admin') return true

      // Check both tokens and combine conditions with OR
      const callerAsDoctor = getCallerFromRequest(req, 'doctors')
      
      const conditions: Where[] = []

      // Allow users to update messages from their appointments
      if (callerAsUser?.collection === 'users' && callerAsUser.id) {
        conditions.push({
          'appointment.user': { equals: Number(callerAsUser.id) },
        })
      }

      // Allow doctors to update messages from their appointments
      if (callerAsDoctor?.collection === 'doctors' && callerAsDoctor.id) {
        conditions.push({
          'appointment.doctor': { equals: Number(callerAsDoctor.id) },
        })
      }

      // Return combined OR query if we have conditions
      if (conditions.length > 0) {
        return conditions.length === 1 
          ? conditions[0] 
          : { or: conditions } as Where
      }

      return false
    },
    delete: ({ req }) => {
      const caller = getCallerFromRequest(req, 'users')
      return caller?.role === 'admin'
    },
    admin: () => true,
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
      name: 'senderType',
      type: 'select',
      required: true,
      label: 'Тип отправителя',
      options: [
        { label: 'Пациент', value: 'user' },
        { label: 'Врач', value: 'doctor' },
      ],
    },
    {
      name: 'senderId',
      type: 'number',
      required: true,
      label: 'ID отправителя',
      index: true,
    },
    {
      name: 'text',
      type: 'textarea',
      required: true,
      label: 'Текст сообщения',
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
