import type { CollectionConfig, PayloadRequest, Where } from 'payload'
import { decodeUsersCookie, decodeSpecificCookie, getCallerFromRequest } from './helpers/auth'
import { revalidateTag } from 'next/cache'
import { DOCTORS_CACHE_TAG } from '@/lib/api/doctors'

/**
 * Populate req.user from the users cookie (payload-token).
 * Appointments are created by regular users.
 */
function ensureReqUser({
  req,
}: {
  req: PayloadRequest
  operation: string
}) {
  if (req.user) return

  // Try users cookie first
  const userDecoded = decodeUsersCookie(req)
  if (userDecoded?.id) {
    req.user = {
      id: userDecoded.id,
      email: userDecoded.email,
      role: userDecoded.role,
      collection: userDecoded.collection,
    } as unknown as PayloadRequest['user']
    return
  }

  // Try doctors cookie
  const doctorDecoded = decodeSpecificCookie(req, 'doctors-token', 'doctors')
  if (doctorDecoded?.id) {
    req.user = {
      id: doctorDecoded.id,
      email: doctorDecoded.email,
      role: 'doctor',
      collection: doctorDecoded.collection,
    } as unknown as PayloadRequest['user']
  }
}

export const Appointments: CollectionConfig = {
  slug: 'appointments',
  admin: {
    useAsTitle: 'doctorName',
    defaultColumns: ['doctorName', 'user', 'date', 'time', 'status'],
    group: 'Записи',
  },
  hooks: {
    beforeOperation: [ensureReqUser],
    beforeChange: [
      async ({ data, operation, req }) => {
        if (operation === 'create') {
          // Validate that the slot is not already booked
          const doctorId = data.doctor
          const date = data.date
          const time = data.time

          if (doctorId && date && time) {
            const existing = await req.payload.find({
              collection: 'appointments',
              where: {
                doctor: { equals: doctorId },
                date: { equals: date },
                time: { equals: time },
                status: { not_equals: 'cancelled' },
              },
              limit: 1,
            })

            if (existing.docs.length > 0) {
              throw new Error('Этот слот уже занят. Пожалуйста, выберите другое время.')
            }
          }
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation === 'create') {
          // Remove the booked slot from the doctor's schedule
          try {
            const doctor = await req.payload.findByID({
              collection: 'doctors',
              id: doc.doctor,
            })

            if (doctor?.schedule) {
              const updatedSchedule = (doctor.schedule as { date: string; slots?: { time: string }[] }[])
                .map((dayEntry) => {
                  if (dayEntry.date === doc.date) {
                    const filteredSlots = (dayEntry.slots || []).filter(
                      (slot) => slot.time !== doc.time
                    )
                    return { ...dayEntry, slots: filteredSlots }
                  }
                  return dayEntry
                })
                // Remove days with no slots left
                .filter((dayEntry) => dayEntry.slots && dayEntry.slots.length > 0)

              await req.payload.update({
                collection: 'doctors',
                id: doc.doctor,
                data: { schedule: updatedSchedule },
              })
            }
          } catch (err) {
            console.error('Failed to update doctor schedule after booking:', err)
          }
        }
        revalidateTag(DOCTORS_CACHE_TAG);
      },
    ],
  },
  access: {
    read: ({ req }: { req: PayloadRequest }) => {
      // Check admin via users token
      const callerAsUser = getCallerFromRequest(req, 'users')
      if (callerAsUser?.role === 'admin') return true
      // Regular user reads their own appointments
      if (callerAsUser?.collection === 'users' && callerAsUser.id) {
        return { user: { equals: Number(callerAsUser.id) } } as Where
      }
      // Doctor reads their own appointments
      const callerAsDoctor = getCallerFromRequest(req, 'doctors')
      if (callerAsDoctor?.collection === 'doctors' && callerAsDoctor.id) {
        return { doctor: { equals: Number(callerAsDoctor.id) } } as Where
      }
      return false
    },
    create: ({ req }) => {
      const caller = getCallerFromRequest(req, 'users')
      // Only logged-in users can create appointments
      return caller?.collection === 'users' && !!caller.id
    },
    update: ({ req }) => {
      const caller = getCallerFromRequest(req, 'users')
      return caller?.role === 'admin'
    },
    delete: ({ req }) => {
      const caller = getCallerFromRequest(req, 'users')
      return caller?.role === 'admin'
    },
    admin: () => true,
  },
  fields: [
    {
      name: 'doctor',
      type: 'relationship',
      relationTo: 'doctors',
      required: true,
      label: 'Врач',
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      label: 'Пациент',
    },
    {
      name: 'doctorName',
      type: 'text',
      label: 'Имя врача',
      admin: {
        description: 'Заполняется автоматически для удобного отображения',
      },
    },
    {
      name: 'userName',
      type: 'text',
      label: 'Имя пациента',
      admin: {
        description: 'Заполняется автоматически',
      },
    },
    {
      name: 'specialty',
      type: 'text',
      label: 'Специализация',
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
      name: 'price',
      type: 'number',
      label: 'Стоимость (руб.)',
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'confirmed',
      label: 'Статус',
      options: [
        { label: 'Подтверждена', value: 'confirmed' },
        { label: 'Завершена', value: 'completed' },
        { label: 'Отменена', value: 'cancelled' },
      ],
    },
  ],
}
