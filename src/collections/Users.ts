import type { CollectionConfig } from 'payload'
import { getCallerFromRequest } from './helpers/auth'



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
        // This is used by Payload's built-in /api/users endpoint.
        // Our custom /api/auth/register route sends emails via sendVerificationEmail() directly.
        const siteUrl = process.env.SERVER_URL || 'http://localhost:3000'
        const verifyUrl = `${siteUrl}/verify-email?token=${token}`
        const name = (user as { name?: string }).name ?? (user as { email: string }).email

        return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.07);">
        <tr><td style="background:#1a56db;padding:32px 40px;">
          <p style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">smartcardio</p>
          <p style="margin:6px 0 0;color:#a5c0f7;font-size:13px;">Телемедицина</p>
        </td></tr>
        <tr><td style="padding:40px 40px 32px;">
          <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#111827;">Подтвердите ваш email</h1>
          <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.6;">Привет, <strong>${name}</strong>!</p>
          <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.6;">Для завершения регистрации подтвердите ваш email-адрес.</p>
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="background:#1a56db;border-radius:10px;">
              <a href="${verifyUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">Подтвердить email</a>
            </td>
          </tr></table>
          <p style="margin:28px 0 0;font-size:13px;color:#6b7280;line-height:1.6;">Или скопируйте ссылку: <a href="${verifyUrl}" style="color:#1a56db;word-break:break-all;">${verifyUrl}</a></p>
        </td></tr>
        <tr><td style="padding:0 40px;"><hr style="border:none;border-top:1px solid #e5e7eb;margin:0;"/></td></tr>
        <tr><td style="padding:24px 40px 32px;">
          <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">Ссылка действительна 24 часа. Если вы не регистрировались — просто проигнорируйте это письмо.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
      },
      generateEmailSubject: () => 'Подтвердите ваш email — smartcardio',
    },
    tokenExpiration: 60 * 60 * 24 * 7, // 7 days
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
    admin : ({req}) => {
      const user = getCallerFromRequest(req, "users");
      return user.role === "admin"
    }
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
