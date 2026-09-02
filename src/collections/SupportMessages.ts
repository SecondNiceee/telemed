import type { CollectionConfig } from 'payload'
import { getCallerFromRequest } from './helpers/auth'

/**
 * Сообщение в диалоге поддержки.
 *
 * Существующая коллекция `messages` привязана к консультации (`appointment`)
 * и к авторизованному отправителю — для анонимной поддержки не годится,
 * поэтому отдельная коллекция.
 *
 * Это первоисточник переписки: Telegram здесь только канал доставки.
 */
export const SupportMessages: CollectionConfig = {
  slug: 'support-messages',
  defaultSort: 'createdAt',
  admin: {
    useAsTitle: 'text',
    defaultColumns: ['conversation', 'sender', 'text', 'createdAt'],
    group: 'Поддержка',
  },
  access: {
    read: ({ req }) => getCallerFromRequest(req, 'users')?.role === 'admin',
    create: () => false,
    update: () => false,
    delete: ({ req }) => getCallerFromRequest(req, 'users')?.role === 'admin',
    admin: () => true,
  },
  fields: [
    {
      name: 'conversation',
      type: 'relationship',
      relationTo: 'support-conversations',
      required: true,
      index: true,
      label: 'Диалог',
    },
    {
      name: 'sender',
      type: 'select',
      options: [
        { label: 'Посетитель', value: 'visitor' },
        { label: 'Оператор', value: 'operator' },
      ],
      required: true,
      label: 'Отправитель',
    },
    {
      name: 'text',
      type: 'textarea',
      required: true,
      label: 'Текст',
    },
    {
      name: 'telegramMessageId',
      type: 'number',
      index: true,
      label: 'ID сообщения в Telegram',
      admin: {
        description:
          'Защита от дублей: Telegram может доставить один и тот же update ' +
          'повторно, если подтверждение offset не дошло.',
      },
    },
  ],
  timestamps: true,
}
