import type { CollectionConfig, PayloadRequest, Where } from 'payload'
import { getPayload } from 'payload'
import config from '@payload-config'
import { DecodedCaller, getCallerFromRequest } from './helpers/auth'
import { revalidateTag } from 'next/cache'
import { DOCTORS_CACHE_TAG } from '@/lib/api/doctors'
import { sendAppointmentEmail } from '@/utils/sendAppointmentEmail'

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
  const userDecoded = getCallerFromRequest(req, 'users') as DecodedCaller || null
  if (userDecoded?.id) {
    req.user = {
      id: userDecoded.id,
      email: userDecoded?.email,
      role: userDecoded?.role,
      collection: userDecoded?.collection,
    } as unknown as PayloadRequest['user']
    return
  }

  // Try doctors cookie
  const doctorDecoded = getCallerFromRequest(req, "doctors") as DecodedCaller || null
  if (doctorDecoded?.id) {
    req.user = {
      id: doctorDecoded.id,
      email: doctorDecoded?.email,
      role: 'doctor',
      collection: doctorDecoded?.collection,
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
      async ({ doc, operation }) => {
        if (operation === 'create') {
          // doc.doctor may be a populated object, a JSON string, or a raw id — extract numeric id
          const doctorRaw: unknown = doc.doctor;
          const doctorId: number =
            typeof doctorRaw === 'object' && doctorRaw !== null
              ? (doctorRaw as { id: number }).id
              : Number(doctorRaw)

          const appointmentDate = doc.date as string
          const appointmentTime = doc.time as string

          // Schedule the doctor update to run AFTER the current transaction commits.
          // Doing it inside afterChange causes a deadlock because the appointment
          // transaction holds a lock and payload.update('doctors') tries to acquire
          // its own lock in the same DB connection.
          setImmediate(async () => {
            try {
              const payload = await getPayload({ config })

              const doctor = await payload.findByID({
                collection: 'doctors',
                id: doctorId,
                overrideAccess: true,
              })

              if (doctor?.schedule) {
                const rawSchedule = doctor.schedule as { date: string; slots?: { time: string }[] }[]

                const updatedSchedule = rawSchedule
                  .map((dayEntry) => {
                    if (dayEntry.date === appointmentDate) {
                      return {
                        ...dayEntry,
                        slots: (dayEntry.slots || []).filter((slot) => slot.time !== appointmentTime),
                      }
                    }
                    return dayEntry
                  })
                  .filter((dayEntry) => dayEntry.slots && dayEntry.slots.length > 0)

                await payload.update({
                  collection: 'doctors',
                  id: doctorId,
                  data: { schedule: updatedSchedule },
                  overrideAccess: true,
                })
              }

              revalidateTag(DOCTORS_CACHE_TAG)

              // Send notification email to doctor
              if (doctor?.email) {
                try {
                  await sendAppointmentEmail({
                    payload,
                    doctorEmail: doctor.email,
                    doctorName: (doc.doctorName as string) || doctor.name || 'Врач',
                    patientName: (doc.userName as string) || 'Пациент',
                    specialty: (doc.specialty as string) || '',
                    date: appointmentDate,
                    time: appointmentTime,
                    price: (doc.price as number) || 0,
                  })
                } catch (emailErr) {
                  console.error('Failed to send appointment email to doctor:', emailErr)
                }
              }
            } catch (err) {
              console.error('Failed to update doctor schedule after booking:', err)
            }
          })
        } else {
          revalidateTag(DOCTORS_CACHE_TAG)
        }
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
