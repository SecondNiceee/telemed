import { APIError, type CollectionConfig } from 'payload'
import { getCallerFromRequest } from './helpers/auth'
import { normalizePhone, PHONE_STORAGE_REGEX } from '@/utils/phone'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'username', 'role'],
    group: 'Пользователи',
  },
  auth: {
    // Вход по номеру телефона (хранится в поле username), email не используется для входа
    loginWithUsername: {
      allowEmailLogin: false,
      requireEmail: false,
      requireUsername: true,
    },
    tokenExpiration: 60 * 60 * 24 * 7, // 7 days
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
    admin: ({ req }) => {
      const user = getCallerFromRequest(req, 'users')
      return user.role === 'admin'
    },
  },
  hooks: {
    beforeLogin: [
      ({ user }) => {
        const candidate = user as unknown as { role?: string; phoneVerified?: boolean }
        if (candidate.role !== 'admin' && !candidate.phoneVerified) {
          throw new APIError('Телефон не подтверждён. Запросите новый код.', 403)
        }
      },
    ],
  },
  fields: [
    {
      name: 'username',
      type: 'text',
      label: 'Телефон',
      required: true,
      unique: true,
      index: true,
      saveToJWT: true,
      admin: {
        description: 'Формат: +7XXXXXXXXXX',
      },
      hooks: {
        beforeValidate: [
          ({ value }) => {
            if (typeof value !== 'string') return value
            return normalizePhone(value) ?? value
          },
        ],
      },
      validate: (value: unknown) => {
        if (typeof value !== 'string' || !PHONE_STORAGE_REGEX.test(value)) {
          return 'Введите телефон в формате +7XXXXXXXXXX'
        }
        return true
      },
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'user',
      label: 'Роль',
      saveToJWT: true,
      options: [
        { label: 'Пользователь', value: 'user' },
        { label: 'Администратор', value: 'admin' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'phoneVerified',
      type: 'checkbox',
      label: 'Телефон подтверждён',
      defaultValue: false,
      saveToJWT: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'name',
      type: 'text',
      label: 'Имя',
    },
    {
      name: 'verificationCode',
      type: 'text',
      label: 'Код подтверждения',
      hidden: true,
    },
    {
      name: 'verificationCodeExpiresAt',
      type: 'date',
      label: 'Код действителен до',
      hidden: true,
    },
    {
      name: 'verificationCodeSentAt',
      type: 'date',
      label: 'Код отправлен',
      hidden: true,
    },
    {
      name: 'verificationAttempts',
      type: 'number',
      label: 'Неудачных попыток',
      defaultValue: 0,
      hidden: true,
    },
  ],
}
