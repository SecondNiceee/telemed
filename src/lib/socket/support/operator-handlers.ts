import type { Payload } from 'payload'
import type { Server as SocketIOServer, Socket } from 'socket.io'
import type { SupportConversation, SupportMessage } from '@/payload-types'
import validateMessageText from '../utils/validateMessageText'
import { isTelegramConfigured, sendMessage } from '@/lib/telegram/client'
import {
  HISTORY_LIMIT,
  INBOX_LIMIT,
  OPERATORS_ROOM,
  authenticateOperator,
  emitOperatorSync,
  emitToVisitor,
  findConversation,
  toConversationDto,
  toDto,
  type SupportConversationDto,
  type SupportOperatorAck,
} from './shared'

type Ack = (response: SupportOperatorAck) => void

function reply(ack: unknown, response: SupportOperatorAck): void {
  if (typeof ack === 'function') (ack as Ack)(response)
}

/**
 * Помечен ли сокет как операторский.
 *
 * Флаг ставится только после успешной проверки в `support:operator:join`.
 * Каждый последующий вызов всё равно перепроверяется — флаг лишь избавляет от
 * лишнего запроса к БД в горячем пути, но сам по себе доступа не даёт.
 */
interface OperatorSocketData {
  supportOperator?: { id: number | string; name: string | null }
}

function operatorOf(socket: Socket): OperatorSocketData['supportOperator'] {
  return (socket.data as OperatorSocketData | undefined)?.supportOperator
}

/**
 * Собрать список диалогов с превью последнего сообщения.
 *
 * Превью берём одним запросом на все диалоги, а не по одному на каждый:
 * сто диалогов означали бы сто обращений к БД при каждом открытии инбокса.
 * Забираем последние сообщения пачкой и раскладываем по диалогам в памяти —
 * первое встреченное для диалога и есть самое свежее, потому что сортировка
 * идёт по убыванию даты.
 */
async function buildInbox(payload: Payload): Promise<SupportConversationDto[]> {
  const conversations = await payload.find({
    collection: 'support-conversations',
    limit: INBOX_LIMIT,
    sort: '-lastMessageAt',
    depth: 0,
    overrideAccess: true,
  })

  const docs = conversations.docs as SupportConversation[]
  if (docs.length === 0) return []

  const messages = await payload.find({
    collection: 'support-messages',
    where: { conversation: { in: docs.map((doc) => doc.id) } },
    sort: '-createdAt',
    // С запасом на диалог: превью косметическое, недобор просто оставит
    // прочерк в списке, а полный текст всегда есть при открытии диалога.
    limit: INBOX_LIMIT * 10,
    depth: 0,
    overrideAccess: true,
  })

  const latest = new Map<string, SupportMessage>()
  for (const message of messages.docs as SupportMessage[]) {
    // depth: 0 отдаёт связь числом, но в типах она — объединение с объектом.
    const conversationId =
      typeof message.conversation === 'object' ? message.conversation.id : message.conversation
    const key = String(conversationId)
    if (!latest.has(key)) latest.set(key, message)
  }

  return docs.map((doc) => toConversationDto(doc, latest.get(String(doc.id))))
}

/**
 * Вход оператора в инбокс: проверяем права, подписываем на комнату и сразу
 * отдаём список диалогов.
 */
export function createOperatorJoinHandler(payload: Payload) {
  return async (socket: Socket, ack?: unknown): Promise<void> => {
    const operator = await authenticateOperator(payload, socket)
    if (!operator) {
      reply(ack, { success: false, error: 'Нужны права администратора' })
      return
    }

    socket.data = { ...(socket.data ?? {}), supportOperator: operator }
    await socket.join(OPERATORS_ROOM)

    try {
      reply(ack, { success: true, conversations: await buildInbox(payload) })
    } catch (error) {
      console.error('[support] не удалось загрузить инбокс', error)
      reply(ack, { success: false, error: 'Не удалось загрузить обращения' })
    }
  }
}

/**
 * Открыть диалог: отдаём переписку и снимаем отметку «непрочитано».
 */
export function createOperatorOpenHandler(io: SocketIOServer, payload: Payload) {
  return async (socket: Socket, data: { publicId?: unknown }, ack?: unknown): Promise<void> => {
    if (!operatorOf(socket)) {
      reply(ack, { success: false, error: 'Нужны права администратора' })
      return
    }

    const conversation = await findConversation(payload, data?.publicId)
    if (!conversation) {
      reply(ack, { success: false, error: 'Диалог не найден' })
      return
    }

    try {
      const history = await payload.find({
        collection: 'support-messages',
        where: { conversation: { equals: conversation.id } },
        sort: 'createdAt',
        limit: HISTORY_LIMIT,
        depth: 0,
        overrideAccess: true,
      })

      const readAt = new Date().toISOString()
      const updated = (await payload.update({
        collection: 'support-conversations',
        id: conversation.id,
        data: { operatorReadAt: readAt },
        overrideAccess: true,
      })) as SupportConversation

      const dto = toConversationDto(updated)

      // Отметку рассылаем всем операторским вкладкам: иначе счётчик
      // непрочитанных в соседней вкладке остался бы висеть.
      emitOperatorSync(io, dto)

      reply(ack, {
        success: true,
        conversation: dto,
        messages: history.docs.map(toDto),
      })
    } catch (error) {
      console.error('[support] не удалось открыть диалог', error)
      reply(ack, { success: false, error: 'Не удалось загрузить переписку' })
    }
  }
}

/**
 * Ответ оператора посетителю.
 */
export function createOperatorReplyHandler(io: SocketIOServer, payload: Payload) {
  return async (
    socket: Socket,
    data: { publicId?: unknown; text?: unknown },
    ack?: unknown,
  ): Promise<void> => {
    const operator = operatorOf(socket)
    if (!operator) {
      reply(ack, { success: false, error: 'Нужны права администратора' })
      return
    }

    const text = validateMessageText(data?.text)
    if (!text) {
      reply(ack, { success: false, error: 'Пустое сообщение' })
      return
    }

    const conversation = await findConversation(payload, data?.publicId)
    if (!conversation) {
      reply(ack, { success: false, error: 'Диалог не найден' })
      return
    }

    try {
      const message = await payload.create({
        collection: 'support-messages',
        data: { conversation: conversation.id, sender: 'operator', text },
        overrideAccess: true,
      })

      const now = new Date().toISOString()
      const updated = (await payload.update({
        collection: 'support-conversations',
        id: conversation.id,
        data: {
          lastMessageAt: now,
          // Отвечая, оператор диалог заведомо прочитал.
          operatorReadAt: now,
          status: 'open',
        },
        overrideAccess: true,
      })) as SupportConversation

      const dto = toDto(message)
      emitToVisitor(io, conversation.publicId, dto)

      emitOperatorSync(io, toConversationDto(updated, message as SupportMessage), dto)

      // Зеркало в Telegram — «по возможности»: канал необязательный, и в РФ
      // он часто недоступен. Ответ посетителю уже ушёл через сокет.
      if (isTelegramConfigured() && conversation.telegramTopicId) {
        try {
          await sendMessage(`Оператор: ${text}`, conversation.telegramTopicId)
        } catch (error) {
          console.error('[support] не удалось отзеркалить ответ в Telegram', {
            error: error instanceof Error ? error.message : error,
          })
        }
      }

      reply(ack, { success: true })
    } catch (error) {
      console.error('[support] не удалось отправить ответ оператора', error)
      reply(ack, { success: false, error: 'Не удалось отправить ответ' })
    }
  }
}

/**
 * Закрыть или снова открыть обращение.
 *
 * Переписку не удаляем: закрытый диалог просто уходит из активного списка.
 * Посетитель при этом может написать снова — его сообщение вернёт статус в
 * `open` (см. гостевой `createSendMessageHandler`).
 */
export function createOperatorStatusHandler(io: SocketIOServer, payload: Payload) {
  return async (
    socket: Socket,
    data: { publicId?: unknown; status?: unknown },
    ack?: unknown,
  ): Promise<void> => {
    if (!operatorOf(socket)) {
      reply(ack, { success: false, error: 'Нужны права администратора' })
      return
    }

    const status = data?.status
    if (status !== 'open' && status !== 'closed') {
      reply(ack, { success: false, error: 'Неизвестный статус' })
      return
    }

    const conversation = await findConversation(payload, data?.publicId)
    if (!conversation) {
      reply(ack, { success: false, error: 'Диалог не найден' })
      return
    }

    try {
      const updated = (await payload.update({
        collection: 'support-conversations',
        id: conversation.id,
        data: { status },
        overrideAccess: true,
      })) as SupportConversation

      const dto = toConversationDto(updated)
      emitOperatorSync(io, dto)

      reply(ack, { success: true, conversation: dto })
    } catch (error) {
      console.error('[support] не удалось изменить статус диалога', error)
      reply(ack, { success: false, error: 'Не удалось изменить статус' })
    }
  }
}
