import type { CollectionConfig } from 'payload'
import { getCallerFromRequest } from './helpers/auth'
import { normalizePhone, PHONE_STORAGE_REGEX } from '@/utils/phone'
import { buildResetPasswordEmail } from '@/utils/buildResetPasswordEmail'

/**
 * Поля, которые нельзя менять через публичный REST API.
 * Серверный роут /api/auth/register работает с overrideAccess: true
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
    defaultColumns: ['name', 'email', 'phone', 'role'],
    group: 'Пользователи',
  },
  auth: {
    // Вход по email + пароль. Подтверждается только email.
    verify: {
      generateEmailHTML: ({ token, user }) => {
        // Используется встроенным эндпоинтом Payload /api/users.
        // Наш роут /api/auth/register отправляет письма через sendVerificationEmail() напрямую.
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
          <p style="margin:6px 0 0;color:#a5c0f7;font-size:13px;">Видеоконсультация с врачом</p>
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
    // Восстановление пароля: письмо со ссылкой на /reset-password?token=...
    forgotPassword: {
      expiration: 1000 * 60 * 60, // 1 час
      generateEmailSubject: () => 'Восстановление пароля — smartcardio',
      generateEmailHTML: ({ token, user } = {}) => {
        const siteUrl = process.env.SERVER_URL || 'http://localhost:3000'
        const typedUser = user as { email: string; name?: string } | undefined

        return buildResetPasswordEmail({
          email: typedUser?.email ?? '',
          name: typedUser?.name,
          resetUrl: `${siteUrl}/reset-password?token=${token}`,
        })
      },
    },
    tokenExpiration: 60 * 60 * 24 * 7, // 7 days
  },
  access: {
    /**
     * Чтение: только свой профиль и админ.
     *
     * Было `read: () => true`, то есть публичный REST отдавал бы список всех
     * пользователей с email и телефонами. Это тот же паттерн, который уже дал
     * утечку записей консультаций: открытым оказывается не один документ, а
     * весь список, и защита «никто не знает id» перестаёт работать.
     *
     * Ограничение безопасно для серверного кода: он ходит через Local API, где
     * overrideAccess по умолчанию true, и ни одного вызова с
     * overrideAccess: false в проекте нет - проверено grep-ом. Логин, /me,
     * подтверждение email и сброс пароля - отдельные операции Payload, они
     * правами на read не ограничены.
     */
    read: ({ req, id }) => {
      const caller = getCallerFromRequest(req, 'users')
      if (caller.role === 'admin') return true
      if (!caller.id) return false
      // id есть при чтении одного документа; для списка сужаем выборку до себя,
      // чтобы find() не возвращал чужие записи.
      if (id !== undefined) return String(id) === caller.id
      return { id: { equals: caller.id } }
    },
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
  fields: [
    {
      name: 'phone',
      type: 'text',
      label: 'Телефон',
      required: true,
      // unique создаёт уникальный индекс в БД — гарантия на уровне хранилища,
      // что один номер не будет привязан к двум аккаунтам (index при unique избыточен).
      unique: true,
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
      access: { update: adminOnlyField, create: adminOnlyField },
    },
    {
      name: 'name',
      type: 'text',
      label: 'Имя',
    },
    /**
     * Отметка о согласии на обработку персональных данных.
     *
     * Хранится не галочка, а доказательство: дата, версия и полный текст. Текст
     * копируется целиком по той же причине, что и в согласии на запись -
     * формулировка со временем меняется, а подтверждать придётся ту, которую
     * человек видел в день регистрации. Ссылка на «действующую редакцию» этого
     * не доказывает.
     *
     * Правка закрыта для всех, кроме админа: отметка о согласии, которую
     * пользователь может выставить себе сам запросом к API, ничего не значит.
     */
    {
      name: 'pdnConsent',
      type: 'group',
      label: 'Согласие на обработку персональных данных',
      admin: { description: 'Заполняется при регистрации, вручную не изменяется' },
      access: { update: adminOnlyField, create: adminOnlyField },
      fields: [
        {
          name: 'acceptedAt',
          type: 'date',
          label: 'Дата и время согласия',
          admin: { date: { pickerAppearance: 'dayAndTime' } },
        },
        {
          name: 'version',
          type: 'text',
          label: 'Версия текста',
        },
        {
          name: 'text',
          type: 'textarea',
          label: 'Текст согласия на момент принятия',
        },
        /**
         * IP, с которого пришло подтверждение.
         *
         * Дата, версия и текст отвечают на вопрос «на что человек согласился»,
         * но не «откуда пришло подтверждение». При споре «я не давал согласия»
         * адрес - дополнительный реквизит акцепта.
         *
         * Сам IP - персональные данные, поэтому он тут не «на всякий случай», а
         * ровно для этой цели, и удаляется вместе с остальными данными аккаунта.
         * Может быть пустым: за прокси адрес не всегда определяется, и NULL
         * честнее выдуманного значения.
         */
        {
          name: 'ip',
          type: 'text',
          label: 'IP-адрес при согласии',
        },
      ],
    },
    /**
     * Акцепт публичной оферты - отдельная группа, а не поле внутри pdnConsent.
     *
     * Разделение принципиальное, а не косметическое. Согласие на обработку ПДн и
     * договор - разные сделки с разной судьбой: согласие можно отозвать, не
     * расторгая договор, а редакцию оферты можно поменять, не затрагивая
     * согласие. В одной группе у них был бы общий момент принятия и общая
     * версия, и после правки оферты выглядело бы так, будто человек заново дал
     * согласие на обработку данных о здоровье. Такое «согласие» ничего не стоит.
     *
     * Правка закрыта для всех, кроме админа - по той же причине, что и у
     * согласия: отметку о принятии договора, которую пользователь может
     * выставить себе сам запросом к API, нельзя предъявить как доказательство.
     */
    {
      name: 'offerAcceptance',
      type: 'group',
      label: 'Принятие публичной оферты',
      admin: { description: 'Заполняется при регистрации, вручную не изменяется' },
      access: { update: adminOnlyField, create: adminOnlyField },
      fields: [
        {
          name: 'acceptedAt',
          type: 'date',
          label: 'Дата и время акцепта',
          admin: { date: { pickerAppearance: 'dayAndTime' } },
        },
        {
          name: 'version',
          type: 'text',
          label: 'Версия оферты',
        },
        /**
         * IP акцепта оферты - отдельно от IP согласия по той же причине, по
         * которой разделены сами группы: это разные сделки. Сейчас оба
         * заполняются в одном запросе, но акцепт новой редакции оферты может
         * произойти позже и с другого адреса, не затрагивая согласие на ПДн.
         */
        {
          name: 'ip',
          type: 'text',
          label: 'IP-адрес при акцепте',
        },
        {
          name: 'text',
          type: 'textarea',
          label: 'Текст оферты на момент принятия',
        },
      ],
    },
  ],
}
