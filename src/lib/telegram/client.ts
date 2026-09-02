/**
 * Тонкая обёртка над Telegram Bot API.
 *
 * Без сторонних зависимостей: нужны три метода, а `fetch` в Node 18+ есть
 * из коробки. Библиотека вроде node-telegram-bot-api принесла бы свой
 * событийный цикл и polling, который конфликтовал бы с нашим (Telegram
 * допускает только одного потребителя getUpdates на бота).
 */

const API_ROOT = 'https://api.telegram.org'

export interface TelegramMessage {
  message_id: number
  message_thread_id?: number
  text?: string
  chat: { id: number; type: string }
  from?: { id: number; is_bot: boolean; first_name?: string }
  /** Присутствует у служебного сообщения о создании темы — его игнорируем. */
  forum_topic_created?: unknown
}

export interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
}

/** Токен задан — значит поддержку можно включать. */
export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_SUPPORT_CHAT_ID)
}

function botToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN не задан')
  return token
}

export function supportChatId(): string {
  const id = process.env.TELEGRAM_SUPPORT_CHAT_ID
  if (!id) throw new Error('TELEGRAM_SUPPORT_CHAT_ID не задан')
  return id
}

/**
 * Вызов метода Bot API.
 *
 * `timeoutMs` больше, чем кажется нужным, ради long polling: getUpdates
 * намеренно держит соединение открытым до 50 секунд.
 */
async function callApi<T>(
  method: string,
  body: Record<string, unknown>,
  timeoutMs = 15_000,
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${API_ROOT}/bot${botToken()}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    const payload = (await response.json()) as {
      ok: boolean
      result?: T
      description?: string
    }

    if (!payload.ok) {
      throw new Error(`Telegram ${method}: ${payload.description ?? 'неизвестная ошибка'}`)
    }

    return payload.result as T
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Создать тему в группе-форуме.
 *
 * Требует, чтобы в группе были включены «Темы», а бот был администратором
 * с правом управления темами. Иначе Telegram ответит ошибкой прав.
 */
export function createForumTopic(name: string): Promise<{ message_thread_id: number }> {
  return callApi('createForumTopic', {
    chat_id: supportChatId(),
    // Telegram обрезает длинные названия сам, но лучше не доводить до предела.
    name: name.slice(0, 128),
  })
}

/** Отправить сообщение в тему (или в чат, если `threadId` не передан). */
export function sendMessage(text: string, threadId?: number): Promise<TelegramMessage> {
  return callApi('sendMessage', {
    chat_id: supportChatId(),
    message_thread_id: threadId,
    text,
    // Разметку не включаем: текст пишет посетитель, и случайные символы
    // Markdown ломали бы отправку целиком.
    disable_web_page_preview: true,
  })
}

/**
 * Забрать новые обновления.
 *
 * `timeout` — это long polling: Telegram держит запрос открытым, пока не
 * появится сообщение. Дешевле и быстрее, чем частые пустые опросы.
 */
export function getUpdates(offset: number, timeoutSeconds = 50): Promise<TelegramUpdate[]> {
  return callApi<TelegramUpdate[]>(
    'getUpdates',
    {
      offset,
      timeout: timeoutSeconds,
      // Нас интересуют только сообщения — остальные типы обновлений не нужны.
      allowed_updates: ['message'],
    },
    // Даём Telegram дожать свой таймаут, плюс запас на сеть.
    (timeoutSeconds + 10) * 1000,
  )
}
