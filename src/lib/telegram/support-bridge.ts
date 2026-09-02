import type { Payload } from 'payload'
import type { Server as SocketIOServer } from 'socket.io'
import { emitToVisitor, toDto } from '@/lib/socket/support/shared'
import { getUpdates, isTelegramConfigured, type TelegramMessage } from './client'

/**
 * Мост «ответ оператора в Telegram → чат на сайте».
 *
 * Почему long polling, а не webhook. `src/server.ts` поднимает Socket.IO
 * отдельным процессом на своём порту; Next.js живёт в другом процессе. Объект
 * `io` принадлежит сокет-процессу, поэтому route handler Next.js физически не
 * может ничего в него отправить — это разная память.
 *
 * Webhook потребовал бы публичного HTTPS-адреса, внутреннего эндпоинта на
 * сокет-сервере и общего секрета между процессами. Long polling внутри
 * сокет-процесса убирает всё это: тот же процесс, который владеет `io`, сам
 * забирает обновления и сразу рассылает их в комнату. Бонусом работает на
 * localhost без туннелей.
 *
 * Ограничение: Telegram допускает только одного потребителя `getUpdates` на
 * бота. Сокет-процесс уже одиночный (in-memory adapter), так что совпадает.
 * Если когда-нибудь понадобится масштабировать сокет-сервер, polling надо
 * будет вынести в отдельный одиночный процесс.
 */

/** Пауза между попытками после сетевой ошибки — растёт до минуты. */
const BACKOFF_START_MS = 1_000
const BACKOFF_MAX_MS = 60_000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Стоит ли обрабатывать это сообщение как ответ оператора.
 *
 * Отсекаем: сообщения самого бота (иначе он ответил бы сам себе), служебные
 * уведомления о создании темы, сообщения без темы (болтовня в общем чате
 * группы) и не из нашей группы.
 */
function isOperatorReply(message: TelegramMessage | undefined): message is TelegramMessage {
  if (!message) return false
  if (message.from?.is_bot) return false
  if (message.forum_topic_created) return false
  if (typeof message.message_thread_id !== 'number') return false
  if (typeof message.text !== 'string' || message.text.trim().length === 0) return false
  return String(message.chat.id) === process.env.TELEGRAM_SUPPORT_CHAT_ID
}

async function handleOperatorReply(
  io: SocketIOServer,
  payload: Payload,
  message: TelegramMessage,
): Promise<void> {
  const topicId = message.message_thread_id as number
  const text = (message.text as string).trim()

  const conversations = await payload.find({
    collection: 'support-conversations',
    where: { telegramTopicId: { equals: topicId } },
    limit: 1,
    depth: 0,
  })

  const conversation = conversations.docs[0]
  if (!conversation) {
    // Тема есть, а диалога нет — например, оператор создал тему вручную.
    // Молча игнорируем: это не ошибка.
    return
  }

  // Защита от повторной доставки: Telegram пришлёт update снова, если
  // подтверждение offset не дошло (обрыв сети, перезапуск процесса).
  const existing = await payload.find({
    collection: 'support-messages',
    where: { telegramMessageId: { equals: message.message_id } },
    limit: 1,
    depth: 0,
  })
  if (existing.docs.length > 0) return

  const saved = await payload.create({
    collection: 'support-messages',
    data: {
      conversation: conversation.id,
      sender: 'operator',
      text,
      telegramMessageId: message.message_id,
    },
  })

  await payload.update({
    collection: 'support-conversations',
    id: conversation.id,
    data: { lastMessageAt: new Date().toISOString() },
  })

  // Сюда и ведёт вся затея: ответ мгновенно уходит в открытый чат на сайте.
  emitToVisitor(io, conversation.publicId, toDto(saved))
}

/**
 * Запустить мост. Возвращает функцию остановки.
 */
export function startSupportBridge(io: SocketIOServer, payload: Payload): () => void {
  if (!isTelegramConfigured()) {
    console.warn('[support-bridge] не запущен: Telegram не настроен')
    return () => {}
  }

  let stopped = false
  // offset = update_id последнего обработанного + 1. Начинаем с 0: Telegram
  // отдаст накопившиеся обновления, дедупликация по telegramMessageId их
  // отфильтрует, если что-то уже было записано.
  let offset = 0
  let backoff = BACKOFF_START_MS

  async function loop(): Promise<void> {
    console.log('[support-bridge] запущен, слушаю ответы операторов')

    while (!stopped) {
      try {
        const updates = await getUpdates(offset)
        // Успешный запрос — сбрасываем задержку.
        backoff = BACKOFF_START_MS

        for (const update of updates) {
          // Смещение двигаем всегда, даже если сообщение нам не подходит,
          // иначе цикл будет вечно получать одно и то же обновление.
          offset = Math.max(offset, update.update_id + 1)

          if (!isOperatorReply(update.message)) continue

          try {
            await handleOperatorReply(io, payload, update.message)
          } catch (error) {
            // Ошибка на одном сообщении не должна останавливать поток —
            // иначе одно проблемное обновление парализует поддержку.
            console.error('[support-bridge] ошибка обработки ответа', error)
          }
        }
      } catch (error) {
        if (stopped) break

        // Обрыв сети или таймаут — ждём и пробуем снова, увеличивая паузу,
        // чтобы не долбить Telegram при длительной недоступности.
        console.error(
          `[support-bridge] сбой опроса, повтор через ${backoff} мс:`,
          error instanceof Error ? error.message : error,
        )
        await sleep(backoff)
        backoff = Math.min(backoff * 2, BACKOFF_MAX_MS)
      }
    }

    console.log('[support-bridge] остановлен')
  }

  void loop()

  return () => {
    stopped = true
  }
}
