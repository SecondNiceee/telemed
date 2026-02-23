import type { CollectionConfig } from 'payload'
import { getCallerFromRequest } from './helpers/auth'

export const Appointments: CollectionConfig = {
  slug: 'appointments',
  admin: {
    useAsTitle: 'doctorName',
    defaultColumns: ['doctorName', 'userName', 'date', 'time', 'status'],
    group: 'Записи',
  },
  access: {
    read: ({ req }) => {
      const caller = getCallerFromRequest(req)
      if (caller.role === 'admin') return true
      // Users can read their own appointments
      if (caller.collection === 'users' && caller.id) {
        return {
          user: { equals: Number(caller.id) },
        }
      }
      // Doctors can read their own appointments
      if (caller.collection === 'doctors' && caller.id) {
        return {
          doctor: { equals: Number(caller.id) },
        }
      }
      // Organisations can read appointments of their doctors (broad read)
      if (caller.collection === 'organisations') return true
      return false
    },
    create: ({ req }) => {
      // Only authenticated users (payload-token) can create appointments
      const caller = getCallerFromRequest(req)
      return caller.collection === 'users' || caller.role === 'admin'
    },
    update: ({ req }) => {
      const caller = getCallerFromRequest(req)
      if (caller.role === 'admin') return true
      // Doctors can update status of their appointments
      if (caller.collection === 'doctors' && caller.id) {
        return {
          doctor: { equals: Number(caller.id) },
        }
      }
      return false
    },
    delete: ({ req }) => {
      const caller = getCallerFromRequest(req)
      return caller.role === 'admin'
    },
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      label: 'Пациент',
    },
    {
      name: 'doctor',
      type: 'relationship',
      relationTo: 'doctors',
      required: true,
      label: 'Врач',
    },
    {
      name: 'date',
      type: 'text',
      required: true,
      label: 'Дата',
      admin: {
        description: 'Формат YYYY-MM-DD',
      },
    },
    {
      name: 'time',
      type: 'text',
      required: true,
      label: 'Время',
      admin: {
        description: 'Формат HH:MM',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'scheduled',
      label: 'Статус',
      options: [
        { label: 'Запланирована', value: 'scheduled' },
        { label: 'Завершена', value: 'completed' },
        { label: 'Отменена', value: 'cancelled' },
      ],
    },
    {
      name: 'doctorName',
      type: 'text',
      label: 'Имя врача',
      admin: {
        description: 'Снимок имени врача на момент записи',
      },
    },
    {
      name: 'userName',
      type: 'text',
      label: 'Имя пациента',
      admin: {
        description: 'Снимок имени пациента на момент записи',
      },
    },
    {
      name: 'price',
      type: 'number',
      label: 'Цена',
      admin: {
        description: 'Цена на момент записи',
      },
    },
  ],
}
