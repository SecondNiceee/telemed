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

      // User reads messages from their appointments
      if (callerAsUser?.collection === 'users' && callerAsUser.id) {
        return {
          'appointment.user': { equals: Number(callerAsUser.id) },
        } as Where
      }

      // Doctor reads messages from their appointments
      const callerAsDoctor = getCallerFromRequest(req, 'doctors')
      if (callerAsDoctor?.collection === 'doctors' && callerAsDoctor.id) {
        return {
          'appointment.doctor': { equals: Number(callerAsDoctor.id) },
        } as Where
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
      const caller = getCallerFromRequest(req, 'users')
      if (caller?.role === 'admin') return true

      // Allow users/doctors to update their own messages (e.g., mark as read)
      const callerAsUser = getCallerFromRequest(req, 'users')
      if (callerAsUser?.collection === 'users' && callerAsUser.id) {
        return {
          'appointment.user': { equals: Number(callerAsUser.id) },
        } as Where
      }

      const callerAsDoctor = getCallerFromRequest(req, 'doctors')
      if (callerAsDoctor?.collection === 'doctors' && callerAsDoctor.id) {
        return {
          'appointment.doctor': { equals: Number(callerAsDoctor.id) },
        } as Where
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
