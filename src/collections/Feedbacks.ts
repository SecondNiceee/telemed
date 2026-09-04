import type { CollectionConfig, PayloadRequest, Where } from 'payload'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCallerFromRequest } from './helpers/auth'
import {
  recalculateDoctorRating,
  recalculateDoctorRatings,
  toDoctorId,
} from './helpers/doctor-rating'

export const Feedbacks: CollectionConfig = {
  slug: 'feedbacks',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['user', 'doctor', 'appointment', 'rating', 'createdAt'],
    group: 'Записи',
  },
  access: {
    read: async ({ req }: { req: PayloadRequest }) => {
      // Admin can read all
      const callerAsUser = getCallerFromRequest(req, 'users')
      if (callerAsUser?.role === 'admin') return true
      
      const conditions: Where[] = []
      
      // User reads their own feedbacks
      if (callerAsUser?.collection === 'users' && callerAsUser.id) {
        conditions.push({ user: { equals: Number(callerAsUser.id) } })
      }
      
      // Doctor reads feedbacks for themselves
      const callerAsDoctor = getCallerFromRequest(req, 'doctors')
      if (callerAsDoctor?.collection === 'doctors' && callerAsDoctor.id) {
        conditions.push({ doctor: { equals: Number(callerAsDoctor.id) } })
      }
      
      // Organisation reads feedbacks for their doctors
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
          conditions.push({ doctor: { in: doctorIds } })
        }
      }
      
      // Public can read all feedbacks (for displaying on doctor profiles)
      // This is intentional - feedbacks are public by nature
      return true
    },
    create: ({ req }) => {
      // Only logged-in users can create feedbacks
      const caller = getCallerFromRequest(req, 'users')
      return caller?.collection === 'users' && !!caller.id
    },
    update: ({ req }) => {
      // Only admin can update feedbacks
      const caller = getCallerFromRequest(req, 'users')
      return caller?.role === 'admin'
    },
    delete: ({ req }) => {
      // Only admin can delete feedbacks
      const caller = getCallerFromRequest(req, 'users')
      return caller?.role === 'admin'
    },
    admin: () => true,
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, req }) => {
        if (operation === 'create') {
          // Validate that the user hasn't already left a feedback for this appointment
          const appointmentId = data.appointment
          const userId = data.user

          if (appointmentId && userId) {
            const existing = await req.payload.find({
              collection: 'feedbacks',
              where: {
                appointment: { equals: appointmentId },
                user: { equals: userId },
              },
              limit: 1,
            })

            if (existing.docs.length > 0) {
              throw new Error('Вы уже оставили отзыв для этой консультации.')
            }
          }

          // Validate that the appointment is completed
          if (appointmentId) {
            const appointment = await req.payload.findByID({
              collection: 'appointments',
              id: appointmentId,
              overrideAccess: true,
            })

            if (appointment.status !== 'completed') {
              throw new Error('Можно оставить отзыв только для завершённых консультаций.')
            }

            // Validate that the user is the patient of this appointment
            const appointmentUserId = typeof appointment.user === 'object' 
              ? appointment.user.id 
              : appointment.user
            
            if (appointmentUserId !== userId) {
              throw new Error('Вы можете оставить отзыв только для своих консультаций.')
            }
          }

          /**
           * Публичное имя автора фиксируется на сервере, а не берётся с клиента и
           * не подтягивается из users при чтении: отзыв виден всем, а имя рядом с
           * отзывом врачу раскрывает факт обращения за медпомощью. Поэтому
           * публикуем только «Имя Ф.» и только если пациент не выбрал анонимность.
           * Email в публичный вывод не попадает никогда.
           */
          data.isAnonymous = data.isAnonymous === true
          data.authorName = null
          if (!data.isAnonymous && userId) {
            const author = await req.payload.findByID({
              collection: 'users',
              id: userId,
              depth: 0,
              overrideAccess: true,
            })
            data.authorName = publicAuthorName(author?.name)
          }
        }
        return data
      },
    ],
    /**
     * Любое изменение отзыва меняет средний балл врача — пересчитываем сразу.
     * Именно afterChange/afterDelete: в beforeChange отзыва в выборке ещё нет
     * (или он ещё старый), и агрегат посчитался бы по предыдущему состоянию.
     */
    afterChange: [
      async ({ doc, previousDoc, req }) => {
        // Админ может перевесить отзыв на другого врача — тогда пересчёт нужен
        // обоим: прежний теряет оценку, новый получает.
        await recalculateDoctorRatings({
          req,
          doctorIds: [toDoctorId(doc?.doctor), toDoctorId(previousDoc?.doctor)],
        })
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        await recalculateDoctorRating({ req, doctorId: toDoctorId(doc?.doctor) })
      },
    ],
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      label: 'Пациент',
      admin: {
        description: 'Пользователь, оставивший отзыв',
      },
    },
    {
      name: 'doctor',
      type: 'relationship',
      relationTo: 'doctors',
      required: true,
      label: 'Врач',
      admin: {
        description: 'Врач, которому оставлен отзыв',
      },
    },
    {
      name: 'appointment',
      type: 'relationship',
      relationTo: 'appointments',
      required: true,
      label: 'Консультация',
      admin: {
        description: 'Консультация, по которой оставлен отзыв',
      },
    },
    {
      name: 'rating',
      type: 'number',
      required: true,
      min: 1,
      max: 5,
      label: 'Оценка',
      admin: {
        description: 'Оценка от 1 до 5 звёзд',
      },
    },
    {
      name: 'text',
      type: 'textarea',
      label: 'Текст отзыва',
      admin: {
        description: 'Текст отзыва пациента',
      },
    },
    {
      name: 'isAnonymous',
      type: 'checkbox',
      defaultValue: false,
      label: 'Анонимный отзыв',
      admin: {
        description: 'Пациент попросил не показывать его имя рядом с отзывом.',
      },
    },
    {
      name: 'authorName',
      type: 'text',
      label: 'Публичное имя автора',
      // Значение с клиента игнорируется: хук beforeChange перезаписывает поле
      // при создании. Field-level access здесь не подходит — он отработал бы
      // после коллекционного хука и стёр выставленное им значение.
      admin: {
        readOnly: true,
        description: 'Имя в формате «Имя Ф.», показывается на странице врача. Пусто у анонимных отзывов.',
      },
    },
  ],
}

/** «Иван Петров» → «Иван П.»; одно слово — как есть; пусто → null. */
function publicAuthorName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const parts = raw.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return null
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[1][0].toUpperCase()}.`
}
