import { randomBytes } from 'crypto'
import type { Payload } from 'payload'
import type { Server as SocketIOServer, Socket } from 'socket.io'
import validateMessageText from '../utils/validateMessageText'
import { createForumTopic, isTelegramConfigured, sendMessage } from '@/lib/telegram/client'
import {
  HISTORY_LIMIT,
  emitToOperators,
  emitToVisitor,
  findConversation,
  isSupportRateLimited,
  roomName,
  toConversationDto,
  toDto,
  visitorLabel,
  type SupportAck,
} from './shared'

type Ack = (response: SupportAck) => void

/** Ack может не прийти от клиента — вызываем только если это функция. */
function reply(ack: unknown, response: SupportAck): void {
  if (typeof ack === 'function') (ack as Ack)(response)
}

/**
 * Адрес посетителя для ограничения создания диалогов.
 *
 * За nginx реальный адрес приходит в X-Forwarded-For, поэтому берём его
 * первым элементом; `socket.handshake.address` — фолбэк для прямого
 * подключения при разработке.
 */
function clientIp(socket: Socket): string {
  const forwarded = socket.handshake.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim()
  }
  return socket.handshake.address || 'unknown'
}

/**
 * Отправка в Telegram «по возможности».
 *
 * Telegram — необязательное зеркало: основной канал оператора это инбокс в
 * админке. Поэтому при незаданном токене выходим молча, иначе на каждое
 * сообщение в лог падала бы ошибка «TELEGRAM_BOT_TOKEN не задан».
 *
 * Если токен задан, но запрос не прошёл (в РФ Telegram ограничен через ТСПУ),
 * ошибку логируем и продолжаем: сообщение уже в БД и видно оператору.
 *
 * `messageId` — наше сообщение в БД. К нему привязываем message_id из
 * Telegram, чтобы мост находил диалог по reply_to_message, когда оператор
 * отвечает через «Ответить» вне темы (например, темы в группе не включены).
 */
async function trySendToTelegram(
  payload: Payload,
  messageId: number | string,
  text: string,
  threadId?: number,
): Promise<void> {
  if (!isTelegramConfigured()) return

  try {
    const sent = await sendMessage(text, threadId)
    await payload.update({
      collection: 'support-messages',
      id: messageId,
      data: { telegramMessageId: sent.message_id },
    })
  } catch (error) {
    console.error('[support] не удалось отправить в Telegram', {
      threadId,
      error: error instanceof Error ? error.message : error,
    })
  }
}

/**
 * Новое обращение: первое сообщение посетителя.
 *
 * Никакой формы перед ним нет — ни имени, ни контакта, ни чекбокса согласия.
 * Чат анонимный, ПДн не собираются, поэтому и согласие не требуется. Ответ
 * приходит в ту же вкладку по сокету, а переписка восстанавливается по
 * publicId из localStorage посетителя.
 */
export function createStartHandler(io: SocketIOServer, payload: Payload) {
  return async (
    socket: Socket,
    data: { text?: unknown; pageUrl?: unknown },
    ack?: unknown,
  ): Promise<void> => {
    const text = validateMessageText(data?.text)
    if (!text) {
      reply(ack, { success: false, error: 'Напишите вопрос' })
      return
    }

    // Ограничение на создание диалогов: иначе бот наплодит тем в группе.
    if (isSupportRateLimited(`start:${clientIp(socket)}`)) {
      reply(ack, { success: false, error: 'Слишком много обращений. Попробуйте позже' })
      return
    }

    const publicId = randomBytes(32).toString('hex')
    const name = visitorLabel(publicId)
    const now = new Date().toISOString()
    const pageUrl = typeof data?.pageUrl === 'string' ? data.pageUrl.slice(0, 500) : undefined
    const userAgent = socket.handshake.headers['user-agent']?.slice(0, 500)

    try {
      const conversation = await payload.create({
        collection: 'support-conversations',
        data: {
          publicId,
          visitorName: name,
          status: 'open',
          lastMessageAt: now,
          pageUrl,
          userAgent,
        },
      })

      // Тему создаём после записи в БД: если Telegram недоступен, обращение
      // всё равно сохранено и его видно в админке.
      let topicId: number | undefined
      if (isTelegramConfigured()) {
        try {
          const topic = await createForumTopic(name)
          topicId = topic.message_thread_id

          await payload.update({
            collection: 'support-conversations',
            id: conversation.id,
            data: { telegramTopicId: topicId },
          })
        } catch (error) {
          console.error('[support] не удалось создать тему в Telegram', {
            conversationId: conversation.id,
            error: error instanceof Error ? error.message : error,
          })
        }
      }

      const message = await payload.create({
        collection: 'support-messages',
        data: { conversation: conversation.id, sender: 'visitor', text },
      })

      await socket.join(roomName(publicId))

      // В тему уходит только текст вопроса и страница обращения, чтобы
      // отвечать по делу. Никаких данных о посетителе у нас нет по замыслу.
      // Без темы (всё в General) добавляем метку диалога — иначе оператору не
      // отличить, кому отвечать.
      const header = topicId ? '' : `${name}\n\n`
      await trySendToTelegram(
        payload,
        message.id,
        `${header}${text}${pageUrl ? `\n\n— страница: ${pageUrl}` : ''}`,
        topicId,
      )

      // Операторам — сразу, это основной канал. Диалог берём из ответа
      // create(), а не перезапрашиваем: telegramTopicId для инбокса не нужен.
      emitToOperators(io, toConversationDto(conversation, message), toDto(message))

      reply(ack, { success: true, publicId, messages: [toDto(message)] })
    } catch (error) {
      console.error('[support] не удалось создать обращение', error)
      reply(ack, { success: false, error: 'Не удалось отправить вопрос' })
    }
  }
}

/**
 * Возврат на сайт: по сохранённому publicId отдаём переписку и комнату.
 */
export function createResumeHandler(payload: Payload) {
  return async (socket: Socket, data: { publicId?: unknown }, ack?: unknown): Promise<void> => {
    const conversation = await findConversation(payload, data?.publicId)

    // Диалога нет (или publicId подделан) — клиент очистит localStorage
    // и покажет форму заново.
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
      })

      await socket.join(roomName(conversation.publicId))

      reply(ack, {
        success: true,
        publicId: conversation.publicId,
        messages: history.docs.map(toDto),
      })
    } catch (error) {
      console.error('[support] не удалось загрузить историю', error)
      reply(ack, { success: false, error: 'Не удалось загрузить переписку' })
    }
  }
}

/**
 * Очередное сообщение в уже открытом диалоге.
 */
export function createSendMessageHandler(io: SocketIOServer, payload: Payload) {
  return async (
    socket: Socket,
    data: { publicId?: unknown; text?: unknown },
    ack?: unknown,
  ): Promise<void> => {
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

    // Ключ — сам диалог, а не socket.id: иначе несколько вкладок дали бы
    // одному человеку кратный лимит.
    if (isSupportRateLimited(`msg:${conversation.publicId}`)) {
      reply(ack, { success: false, error: 'Слишком часто. Подождите немного' })
      return
    }

    try {
      const message = await payload.create({
        collection: 'support-messages',
        data: { conversation: conversation.id, sender: 'visitor', text },
      })

      const updated = await payload.update({
        collection: 'support-conversations',
        id: conversation.id,
        data: { lastMessageAt: new Date().toISOString(), status: 'open' },
      })

      // Эхо от сервера — единственный источник сообщений в UI. Клиент не
      // добавляет свою копию локально, поэтому дублей не возникает, а порядок
      // сообщений одинаков во всех вкладках.
      emitToVisitor(io, conversation.publicId, toDto(message))
      emitToOperators(io, toConversationDto(updated, message), toDto(message))

      const topicId = conversation.telegramTopicId ?? undefined
      const header = topicId ? '' : `${conversation.visitorName}\n\n`
      await trySendToTelegram(payload, message.id, `${header}${text}`, topicId)

      reply(ack, { success: true })
    } catch (error) {
      console.error('[support] не удалось отправить сообщение', error)
      reply(ack, { success: false, error: 'Не удалось отправить сообщение' })
    }
  }
}
