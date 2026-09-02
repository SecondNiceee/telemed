import type { CollectionConfig } from 'payload'
import { getCallerFromRequest } from './helpers/auth'

/**
 * Обращение посетителя через чат поддержки на сайте.
 *
 * Один документ = один диалог = одна тема в Telegram-группе.
 *
 * Доступ закрыт для всех, кроме админа: посетитель работает не через REST API
 * Payload, а через сокет-процесс, который обращается к локальному API напрямую
 * (там access control не применяется). Поэтому открывать коллекцию наружу не
 * нужно — и не следует, в ней лежат контакты людей.
 */
export const SupportConversations: CollectionConfig = {
  slug: 'support-conversations',
  defaultSort: '-lastMessageAt',
  admin: {
    useAsTitle: 'visitorName',
    defaultColumns: ['visitorName', 'visitorContact', 'status', 'lastMessageAt'],
    group: 'Поддержка',
  },
  access: {
    read: ({ req }) => getCallerFromRequest(req, 'users')?.role === 'admin',
    create: () => false,
    update: ({ req }) => getCallerFromRequest(req, 'users')?.role === 'admin',
    delete: ({ req }) => getCallerFromRequest(req, 'users')?.role === 'admin',
    admin: () => true,
  },
  fields: [
    {
      name: 'publicId',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      label: 'Публичный идентификатор',
      admin: {
        description:
          'Случайные 32 байта. Одновременно имя комнаты сокета и токен доступа ' +
          'к переписке — знание publicId даёт доступ к диалогу, поэтому наружу ' +
          'отдаётся только он, а не числовой id.',
      },
    },
    {
      name: 'visitorName',
      type: 'text',
      required: true,
      label: 'Имя посетителя',
    },
    {
      name: 'visitorContact',
      type: 'text',
      required: true,
      label: 'Контакт',
      admin: {
        description: 'Телефон или email. В Telegram не передаётся — только здесь.',
      },
    },
    {
      name: 'contactKind',
      type: 'select',
      options: [
        { label: 'Телефон', value: 'phone' },
        { label: 'Email', value: 'email' },
      ],
      required: true,
      label: 'Тип контакта',
    },
    {
      name: 'telegramTopicId',
      type: 'number',
      index: true,
      label: 'ID темы в Telegram',
      admin: {
        description:
          'message_thread_id темы. По нему ответ оператора находит нужный диалог. ' +
          'Пусто — тему создать не удалось, диалог виден только здесь.',
      },
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Открыт', value: 'open' },
        { label: 'Закрыт', value: 'closed' },
      ],
      defaultValue: 'open',
      required: true,
      index: true,
      label: 'Статус',
    },
    {
      name: 'consentAt',
      type: 'date',
      required: true,
      label: 'Согласие на обработку получено',
      admin: {
        description: 'Момент, когда посетитель отметил чекбокс согласия.',
      },
    },
    {
      name: 'lastMessageAt',
      type: 'date',
      index: true,
      label: 'Последнее сообщение',
    },
    {
      name: 'pageUrl',
      type: 'text',
      label: 'Страница обращения',
      admin: {
        description: 'Откуда написал посетитель — помогает отвечать по делу.',
      },
    },
    {
      name: 'userAgent',
      type: 'text',
      label: 'User-Agent',
    },
  ],
  timestamps: true,
}
