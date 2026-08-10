import { APIError, type CollectionConfig } from 'payload'
import { getCallerFromRequest } from './helpers/auth'
import { normalizePhone, PHONE_STORAGE_REGEX } from '@/utils/phone'

/**
 * Поля, которые нельзя менять через публичный REST API.
 * Серверные роуты (register/verify-phone/resend-code) работают с overrideAccess: true
 * и эти проверки не затрагивают.
 */
const adminOnlyField = ({ req }: { req: Parameters<typeof getCallerFromRequest>[0] }) => {
  const caller = getCallerFromRequest(req, 'users')
  return caller.role === 'admin'
}

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
    // Регистрация идёт только через /api/auth/register (Local API, overrideAccess: true),
    // поэтому публичное создание через REST закрыто
    create: ({ req }) => getCallerFromRequest(req, 'users').role === 'admin',
    // Пользователь правит только себя — иначе можно было бы сменить чужой пароль
    update: ({ req, id }) => {
      const caller = getCallerFromRequest(req, 'users')
      if (caller.role === 'admin') return true
      return Boolean(caller.id && id !== undefined && String(id) === caller.id)
    },
    delete: ({ req }) => getCallerFromRequest(req, 'users').role === 'admin',
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
      // Менять телефон можно только из админки — иначе можно обойти подтверждение
      access: { update: adminOnlyField },
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
      access: { update: adminOnlyField, create: adminOnlyField },
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
      // Подтверждение выставляется только серверным роутом /api/auth/verify-phone
      access: { update: adminOnlyField, create: adminOnlyField },
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
      access: { read: adminOnlyField, update: adminOnlyField, create: adminOnlyField },
    },
    {
      name: 'verificationCodeExpiresAt',
      type: 'date',
      label: 'Код действителен до',
      hidden: true,
      access: { read: adminOnlyField, update: adminOnlyField, create: adminOnlyField },
    },
    {
      name: 'verificationCodeSentAt',
      type: 'date',
      label: 'Код отправлен',
      hidden: true,
      access: { read: adminOnlyField, update: adminOnlyField, create: adminOnlyField },
    },
    {
      name: 'verificationAttempts',
      type: 'number',
      label: 'Неудачных попыток',
      defaultValue: 0,
      hidden: true,
      access: { read: adminOnlyField, update: adminOnlyField, create: adminOnlyField },
    },
  ],
}
