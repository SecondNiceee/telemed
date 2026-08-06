import type { CollectionConfig, PayloadRequest, Where } from 'payload'
import { getPayload } from 'payload'
import config from '@payload-config'
import { DecodedCaller, getCallerFromRequest } from './helpers/auth'
import { DOCTORS_CACHE_TAG } from '@/lib/api/doctors'
import { sendAppointmentEmail, sendPatientAppointmentEmail } from '@/utils/sendAppointmentEmail'

// Safe wrapper for revalidateTag that works in build time
const revalidateDoctorsCache = async () => {
  try {
    const { revalidateTag } = await import('next/cache')
    revalidateTag(DOCTORS_CACHE_TAG)
  } catch {
    // revalidateTag is only available in Server Component context
  }
}

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

              revalidateDoctorsCache()

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

              // Send notification email to patient
              const userRaw: unknown = doc.user
              const userId: number =
                typeof userRaw === 'object' && userRaw !== null
                  ? (userRaw as { id: number }).id
                  : Number(userRaw)
              
              try {
                const user = await payload.findByID({
                  collection: 'users',
                  id: userId,
                  overrideAccess: true,
                })
                
                if (user?.email) {
                  await sendPatientAppointmentEmail({
                    payload,
                    patientEmail: user.email,
                    patientName: (doc.userName as string) || user.name || 'Пациент',
                    doctorName: (doc.doctorName as string) || doctor?.name || 'Врач',
                    specialty: (doc.specialty as string) || '',
                    date: appointmentDate,
                    time: appointmentTime,
                    price: (doc.price as number) || 0,
                  })
                }
              } catch (emailErr) {
                console.error('Failed to send appointment email to patient:', emailErr)
              }
            } catch (err) {
              console.error('Failed to update doctor schedule after booking:', err)
            }
          })
        } else {
          revalidateDoctorsCache()
        }
      },
    ],
  },
  access: {
    read: async ({ req }: { req: PayloadRequest }) => {
      // Check admin via users token
      const callerAsUser = getCallerFromRequest(req, 'users')
      if (callerAsUser?.role === 'admin') return true
      
      // Check both tokens and combine conditions with OR
      const callerAsDoctor = getCallerFromRequest(req, 'doctors')
      const callerAsOrg = getCallerFromRequest(req, 'organisations')
      
      const conditions: Where[] = []
      
      // Regular user reads their own appointments
      if (callerAsUser?.collection === 'users' && callerAsUser.id) {
        conditions.push({ user: { equals: Number(callerAsUser.id) } })
      }
      
      // Doctor reads their own appointments
      if (callerAsDoctor?.collection === 'doctors' && callerAsDoctor.id) {
        conditions.push({ doctor: { equals: Number(callerAsDoctor.id) } })
      }
      
      // Organisation reads appointments for their doctors
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
          conditions.push({ doctor: { in: doctorIds } })
        }
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
      const caller = getCallerFromRequest(req, 'users')
      // Only logged-in users can create appointments
      return caller?.collection === 'users' && !!caller.id
    },
    update: ({ req }) => {
      // Admin can update any appointment
      const userCaller = getCallerFromRequest(req, 'users')
      if (userCaller?.role === 'admin') return true
      
      // Doctor can update their own appointments (e.g., change status)
      const doctorCaller = getCallerFromRequest(req, 'doctors')
      if (doctorCaller?.collection === 'doctors' && doctorCaller.id) {
        return { doctor: { equals: Number(doctorCaller.id) } }
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
    // Почему специализация в свою очередь. Не привязана к специалиазации (то есть Category);
    {
      name: 'specialty',
      type: 'text',
      label: 'Специальность',
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
        { label: 'В процессе', value: 'in_progress' },
        { label: 'Завершена', value: 'completed' },
        { label: 'Отменена', value: 'cancelled' },
      ],
    },
    {
      name: 'connectionType',
      type: 'select',
      required: false,
      defaultValue: 'chat',
      label: 'Вид связи',
      options: [
        { label: 'Чат', value: 'chat' },
        { label: 'Аудио', value: 'audio' },
        { label: 'Видео', value: 'video' },
      ],
      admin: {
        description: 'Предпочтительный способ связи пациента',
      },
    },
    {
      name: 'chatBlocked',
      type: 'checkbox',
      defaultValue: false,
      label: 'Чат заблокирован',
      admin: {
        description: 'Если включено, пациент не может отправлять сообщения',
      },
    },
    {
      name: 'recording',
      type: 'upload',
      relationTo: 'media',
      label: 'Запись консультации',
      admin: {
        description: 'Видеозапись видеоконсультации (если проводилась)',
      },
    },
    // Active call state - stored in DB for reconnection support
    {
      name: 'activeCall',
      type: 'group',
      label: 'Активный звонок',
      admin: {
        description: 'Состояние текущего видеозвонка для поддержки переподключения',
      },
      fields: [
        {
          name: 'isActive',
          type: 'checkbox',
          defaultValue: false,
          label: 'Звонок активен',
        },
        {
          name: 'startedAt',
          type: 'date',
          label: 'Время начала',
          admin: {
            date: {
              pickerAppearance: 'dayAndTime',
            },
          },
        },
        {
          name: 'doctorPeerId',
          type: 'text',
          label: 'PeerJS ID врача',
        },
        {
          name: 'userPeerId',
          type: 'text',
          label: 'PeerJS ID пациента',
        },
        {
          name: 'doctorConnected',
          type: 'checkbox',
          defaultValue: false,
          label: 'Врач подключен',
        },
        {
          name: 'userConnected',
          type: 'checkbox',
          defaultValue: false,
          label: 'Пациент подключен',
        },
      ],
    },
  ],
}
