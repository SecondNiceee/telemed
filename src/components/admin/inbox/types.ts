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
  /** Техническая метка «Посетитель #xxxx» — чат анонимный, имя не собирается. */
  visitorName: string
  status: 'open' | 'closed'
  lastMessageAt: string | null
  operatorReadAt: string | null
  pageUrl: string | null
  createdAt: string
  lastMessagePreview: string | null
  lastMessageSender: 'visitor' | 'operator' | null
}

/**
 * Ждёт ли диалог ответа.
 *
 * Правило одно и то же на сервере и в трёх местах клиента (список, счётчик,
 * заголовок вкладки), поэтому живёт здесь: разъехавшиеся копии дали бы
 * «непрочитанное» в списке при нулевом счётчике.
 *
 * Завершённые диалоги непрочитанными не считаем: оператор сам закрыл вопрос.
 */
export function isUnread(conversation: InboxConversation): boolean {
  if (conversation.status === 'closed') return false
  if (!conversation.lastMessageAt) return false
  // Оператор ещё не открывал диалог — значит непрочитан.
  if (!conversation.operatorReadAt) return true
  return new Date(conversation.lastMessageAt) > new Date(conversation.operatorReadAt)
}
