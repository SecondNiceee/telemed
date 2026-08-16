import type { CollectionConfig, PayloadRequest, Where } from 'payload'
import { getPayload } from 'payload'
import config from '@payload-config'
import { DecodedCaller, getCallerFromRequest } from './helpers/auth'
import {
  applyBookingGuards,
  applyUpdateGuards,
  isSlotConflictError,
  SLOT_TAKEN_MESSAGE,
} from './helpers/appointment-booking-guard'
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

/** Extract a numeric id from a relationship value that may be populated, a string, or a raw id. */
function toId(raw: unknown): number {
  return typeof raw === 'object' && raw !== null ? (raw as { id: number }).id : Number(raw)
}

type PayloadInstance = Awaited<ReturnType<typeof getPayload>>

/**
 * Notify the doctor and the patient about a booked consultation.
 * Called only once the appointment is actually paid/confirmed, so unpaid
 * holds ("Ожидает оплаты") never trigger notifications.
 */
async function sendBookingEmails({
  payload,
  doc,
  doctor,
}: {
  payload: PayloadInstance
  doc: Record<string, unknown>
  doctor: { email?: string | null; name?: string | null } | null
}) {
  const appointmentDate = doc.date as string
  const appointmentTime = doc.time as string

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

  try {
    const user = await payload.findByID({
      collection: 'users',
      id: toId(doc.user),
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
}

export const Appointments: CollectionConfig = {
  slug: 'appointments',
  admin: {
    useAsTitle: 'doctorName',
    defaultColumns: ['doctorName', 'user', 'date', 'time', 'status'],
    group: 'Записи',
  },
  indexes: [
    // Покрывает releaseExpiredHolds(): status + paymentExpiresAt.
    // Без него sweep делает Seq Scan по всей таблице на каждый запрос страницы.
    { fields: ['status', 'paymentExpiresAt'] },
    // Тот же sweep, но суженный по врачу (страница /doctor/[id]).
    { fields: ['doctor', 'status', 'paymentExpiresAt'] },
    // Sweep, суженный по пользователю (личный кабинет /lk).
    { fields: ['user', 'status', 'paymentExpiresAt'] },
  ],
  hooks: {
    // Гонку за слот ловит уникальный индекс в БД, но наружу это летит как
    // невнятная 500 с текстом про duplicate key. Переводим в понятный 409 —
    // тот же текст, что и у предварительной проверки в beforeChange.
    afterError: [
      ({ error }) => {
        if (!isSlotConflictError(error)) return

        return {
          status: 409,
          response: { errors: [{ message: SLOT_TAKEN_MESSAGE }] },
        }
      },
    ],
    beforeOperation: [ensureReqUser],
    beforeChange: [
      async ({ data, operation, req, originalDoc }) => {
        if (operation === 'update') {
          // access.update пускает сюда админа и врача, но не ограничивает набор
          // полей: без whitelist врач мог бы выставить себе confirmed + paidAt.
          await applyUpdateGuards({ data, req, originalDoc })
          return data
        }

        if (operation === 'create') {
          // Тело запроса приходит от клиента: принудительно перезаписываем
          // user / price / status / paymentExpiresAt и проверяем сам слот.
          await applyBookingGuards({ data, req })

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
              limit: 10,
            })

            // An unpaid hold whose 15-minute window has elapsed no longer occupies the slot.
            const blocking = existing.docs.filter((appt) => {
              if (appt.status !== 'pending_payment') return true
              if (!appt.paymentExpiresAt) return true
              return new Date(appt.paymentExpiresAt).getTime() > Date.now()
            })

            // Это только быстрая проверка для понятной ошибки. От гонки
            // «два пациента — один слот» защищает частичный уникальный индекс
            // appointments_slot_unique (миграция
            // src/migrations/20260815_000000_appointments_slot_unique.ts):
            // между этим find и вставкой есть окно, в которое проходят оба запроса.
            if (blocking.length > 0) {
              throw new Error(SLOT_TAKEN_MESSAGE)
            }
          }
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation }) => {
        if (operation === 'create') {
          // doc.doctor may be a populated object, a JSON string, or a raw id — extract numeric id
          const doctorId: number = toId(doc.doctor)

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

              // Unpaid holds must stay silent — notifications go out only once paid.
              if (doc.status !== 'pending_payment') {
                await sendBookingEmails({ payload, doc, doctor })
              }
            } catch (err) {
              console.error('Failed to update doctor schedule after booking:', err)
            }
          })
          return
        }

        revalidateDoctorsCache()

        // Payment just went through: the hold became a real, confirmed booking.
        if (previousDoc?.status === 'pending_payment' && doc.status === 'confirmed') {
          setImmediate(async () => {
            try {
              const payload = await getPayload({ config })
              const doctor = await payload.findByID({
                collection: 'doctors',
                id: toId(doc.doctor),
                overrideAccess: true,
              })
              await sendBookingEmails({ payload, doc, doctor })
            } catch (err) {
              console.error('Failed to send emails after payment:', err)
            }
          })
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
        { label: 'Ожидает оплаты', value: 'pending_payment' },
        { label: 'Подтверждена', value: 'confirmed' },
        { label: 'В процессе', value: 'in_progress' },
        { label: 'Завершена', value: 'completed' },
        { label: 'Отменена', value: 'cancelled' },
      ],
    },
    {
      name: 'paymentExpiresAt',
      type: 'date',
      label: 'Бронь действует до',
      admin: {
        description:
          'Пока запись в статусе «Ожидает оплаты», слот забронирован до этого времени. После истечения слот возвращается в расписание врача.',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'paidAt',
      type: 'date',
      label: 'Оплачено в',
      admin: {
        description: 'Время успешной оплаты консультации',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      /**
       * Платёж в ЮKassa.
       *
       * Клиент и врач эти поля не пишут: их нет ни в одном whitelist'е
       * `appointment-booking-guard`, поэтому любые присланные значения
       * вырезаются (create) или откатываются к текущим (update). Заполняет их
       * только серверный код в `lib/server/appointment-payments.ts`.
       */
      name: 'payment',
      type: 'group',
      label: 'Платёж',
      admin: {
        description:
          'Состояние оплаты в ЮKassa. Заполняется автоматически при создании платежа и при получении уведомления.',
      },
      fields: [
        {
          name: 'provider',
          type: 'text',
          label: 'Провайдер',
          admin: { readOnly: true },
        },
        {
          name: 'paymentId',
          type: 'text',
          label: 'ID платежа',
          // Уведомление ЮKassa приходит с id платежа, а не записи: без индекса
          // каждый вебхук делал бы Seq Scan по всей таблице записей.
          index: true,
          admin: { readOnly: true },
        },
        {
          name: 'status',
          type: 'select',
          label: 'Статус платежа',
          options: [
            { label: 'Ожидает оплаты', value: 'pending' },
            { label: 'Ожидает подтверждения', value: 'waiting_for_capture' },
            { label: 'Оплачен', value: 'succeeded' },
            { label: 'Отменён', value: 'canceled' },
            { label: 'Возвращён', value: 'refunded' },
          ],
          admin: { readOnly: true },
        },
        {
          name: 'amount',
          type: 'number',
          label: 'Сумма платежа (руб.)',
          admin: { readOnly: true },
        },
        {
          name: 'method',
          type: 'text',
          label: 'Способ оплаты',
          admin: { readOnly: true },
        },
        {
          // Номер попытки: входит в Idempotence-Key, чтобы после отменённого
          // платежа можно было создать новый, а двойной клик — нет.
          name: 'attempts',
          type: 'number',
          label: 'Попыток оплаты',
          defaultValue: 0,
          admin: { readOnly: true },
        },
        {
          name: 'refundId',
          type: 'text',
          label: 'ID возврата',
          admin: {
            readOnly: true,
            description:
              'Заполняется, если оплата пришла после истечения брони и деньги вернули автоматически.',
          },
        },
        {
          name: 'refundedAt',
          type: 'date',
          label: 'Возврат выполнен',
          admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
        },
        {
          name: 'checkedAt',
          type: 'date',
          label: 'Последняя сверка с ЮKassa',
          admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
        },
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
          label: '��ремя начала',
          admin: {
            date: {
              pickerAppearance: 'dayAndTime',
            },
          },
        },
        {
          name: 'doctorPeerId',
          type: 'text',
          label: 'PeerJS ID в��ача',
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
