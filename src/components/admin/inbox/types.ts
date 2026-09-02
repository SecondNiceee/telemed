/**
 * Типы инбокса оператора.
 *
 * Повторяют DTO из `src/lib/socket/support/shared.ts`, но объявлены отдельно:
 * тот модуль тянет за собой `payload` и серверные утилиты, а импорт типа из
 * него утащил бы всё это в клиентский бандл.
 */

export interface InboxMessage {
  id: number
  sender: 'visitor' | 'operator'
  text: string
  createdAt: string
}

export interface InboxConversation {
  publicId: string
  visitorName: string
  visitorContact: string
  contactKind: 'phone' | 'email'
  status: 'open' | 'closed'
  lastMessageAt: string | null
  operatorReadAt: string | null
  pageUrl: string | null
  createdAt: string
  lastMessagePreview: string | null
  lastMessageSender: 'visitor' | 'operator' | null
}
