import type { CollectionConfig } from 'payload'
import { getCallerFromRequest } from './helpers/auth'

/**
 * Обращение посетителя через чат поддержки на сайте.
 *
 * Один документ = один диалог = одна тема в Telegram-группе.
 *
 * Чат анонимный: имя, телефон и email у посетителя не спрашиваются, поэтому
 * согласие на обработку ПДн для него не требуется, а в Telegram уходит только
 * текст вопроса. `visitorName` — это техническая метка «Посетитель #xxxx»,
 * чтобы оператору было чем различать диалоги.
 *
 * Доступ закрыт для всех, кроме админа: посетитель работает не через REST API
 * Payload, а через сокет-процесс, который обращается к локальному API напрямую
 * (там access control не применяется).
 */
export const SupportConversations: CollectionConfig = {
  slug: 'support-conversations',
  defaultSort: '-lastMessageAt',
  admin: {
    useAsTitle: 'visitorName',
    defaultColumns: ['visitorName', 'status', 'lastMessageAt'],
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
      label: 'Метка посетителя',
      admin: {
        description:
          'Техническая метка вида «Посетитель #a1b2», выдаётся сервером. ' +
          'Настоящее имя не запрашивается.',
      },
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
      name: 'lastMessageAt',
      type: 'date',
      index: true,
      label: 'Последнее сообщение',
    },
    {
      name: 'operatorReadAt',
      type: 'date',
      label: 'Прочитано оператором',
      admin: {
        description:
          'Момент, когда оператор последний раз открывал диалог в инбоксе. ' +
          'Непрочитанным считается диалог, у которого lastMessageAt новее этой ' +
          'отметки. Метка времени, а не счётчик: она идемпотентна — повторное ' +
          'открытие диалога из двух вкладок не может «сбить» число.',
      },
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
