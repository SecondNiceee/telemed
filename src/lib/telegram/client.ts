/**
 * Тонкая обёртка над Telegram Bot API.
 *
 * Без сторонних зависимостей: нужны три метода, а `fetch` в Node 18+ есть
 * из коробки. Библиотека вроде node-telegram-bot-api принесла бы свой
 * событийный цикл и polling, который конфликтовал бы с нашим (Telegram
 * допускает только одного потребителя getUpdates на бота).
 */

/**
 * Куда ходить за Bot API.
 *
 * По умолчанию — напрямую в Telegram. Если хостинг до него не достаёт,
 * в `TELEGRAM_API_BASE` указывается адрес нашего прокси на Vercel
 * (см. `telegram-proxy/README.md`), а в `TELEGRAM_PROXY_SECRET` — его секрет.
 * Формат путей у прокси тот же, что у Telegram, поэтому меняется только корень.
 */
function apiRoot(): string {
  return (process.env.TELEGRAM_API_BASE ?? 'https://api.telegram.org').replace(/\/+$/, '')
}

/**
 * Сколько секунд Telegram держит getUpdates открытым.
 *
 * Напрямую — 50, это рекомендуемое значение. Через прокси на Vercel надо
 * меньше (~40): у функции лимит 60 секунд на весь запрос, и 50 + сеть в него
 * не влезают стабильно.
 */
export function pollTimeoutSeconds(): number {
  const raw = Number(process.env.TELEGRAM_POLL_TIMEOUT_SECONDS)
  return Number.isFinite(raw) && raw > 0 && raw <= 50 ? Math.floor(raw) : 50
}

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

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  // Секрет прокси уходит только если он задан — напрямую в Telegram лишний
  // заголовок безвреден, но и незачем.
  const proxySecret = process.env.TELEGRAM_PROXY_SECRET
  if (proxySecret) headers['x-telegram-proxy-secret'] = proxySecret

  try {
    const response = await fetch(`${apiRoot()}/bot${botToken()}/${method}`, {
      method: 'POST',
      headers,
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
export function getUpdates(
  offset: number,
  timeoutSeconds = pollTimeoutSeconds(),
): Promise<TelegramUpdate[]> {
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
