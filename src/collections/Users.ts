import type { CollectionConfig, PayloadRequest } from 'payload'
import { getCallerFromRequest, decodeUsersCookie } from './helpers/auth'

/**
 * Populate req.user from the users cookie (payload-token) without a DB query.
 * JWT already contains id, role, email, collection -- enough for all access checks.
 */
function ensureReqUser({
  req,
}: {
  req: PayloadRequest
  operation: string
}) {
  if (req.user) return

  const decoded = decodeUsersCookie(req)
  if (!decoded?.id) return

  req.user = {
    id: decoded.id,
    email: decoded.email,
    role: decoded.role,
    collection: decoded.collection,
  } as unknown as PayloadRequest['user']
}

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'role'],
    group: 'Пользователи',
  },
  auth: {
    verify: {
      generateEmailHTML: ({ token, user }) => {
        const siteUrl = process.env.SERVER_URL || 'http://localhost:3000'
        const verifyUrl = `${siteUrl}/verify-email?token=${token}&id=${(user as { id: string }).id}`
        return `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
            <h2 style="margin-bottom:8px">Подтверждение email</h2>
            <p>Привет, ${(user as { name?: string }).name ?? (user as { email: string }).email}!</p>
            <p>Для завершения регистрации перейдите по ссылке ниже:</p>
            <a href="${verifyUrl}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none">
              Подтвердить email
            </a>
            <p style="margin-top:24px;color:#6b7280;font-size:14px">Ссылка действительна 24 часа. Если вы не регистрировались — просто проигнорируйте это письмо.</p>
          </div>
        `
      },
      generateEmailSubject: () => 'Подтверждение email на сайте',
    },
    tokenExpiration: 60 * 60 * 24 * 7, // 7 days
  },
  hooks: {
    beforeOperation: [ensureReqUser],
  },
  access: {
    read: () => true,
    create: ({ req }) => {
      // Allow self-registration (no auth) as well as admin creation
      const caller = getCallerFromRequest(req, 'users')
      if (!req.user) return true // unauthenticated = self-registration
      return caller?.role === 'admin'
    },
    update: ({ req, id }) => {
      const caller = getCallerFromRequest(req, 'users')
      if (caller?.role === 'admin') return true
      if (caller?.id && String(caller.id) === String(id)) return true
      return false
    },
    delete: ({ req }) => {
      const caller = getCallerFromRequest(req, 'users')
      return caller?.role === 'admin'
    },
    admin: ({ req }) => {
      const caller = getCallerFromRequest(req, 'users')
      return caller?.role === 'admin'
    },
  },
  fields: [
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
      name: 'name',
      type: 'text',
      label: 'Имя',
    },
  ],
}
