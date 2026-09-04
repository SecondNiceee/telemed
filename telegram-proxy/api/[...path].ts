/**
 * Прокси к Telegram Bot API для хостинга, у которого нет доступа к api.telegram.org.
 *
 * Деплоится отдельным проектом Vercel (Root Directory = `telegram-proxy`).
 * Основное приложение на Рег.облаке указывает на него через `TELEGRAM_API_BASE`
 * и подписывает каждый запрос заголовком `x-telegram-proxy-secret`.
 *
 * Что проходит через прокси: только текст вопросов посетителей и ответов
 * операторов. Чат поддержки анонимный — имён и контактов в нём нет по замыслу,
 * так что персональные данные через иностранный сервер не идут.
 *
 * Почему секрет обязателен: без него любой, кто узнает адрес, сможет гонять
 * через нашу функцию запросы к своим ботам и выжирать лимиты плана.
 *
 * Почему не универсальный прокси: путь жёстко проверяется на форму
 * `/bot<token>/<method>`. Функция не должна уметь ходить куда-либо, кроме
 * Bot API, даже если секрет утечёт.
 */

const UPSTREAM = 'https://api.telegram.org'

/** `/bot123456:ABC-DEF.../sendMessage` — и ничего другого. */
const BOT_API_PATH = /^\/bot\d+:[A-Za-z0-9_-]{20,}\/[A-Za-z]+$/

/**
 * Запас относительно `maxDuration: 60` в vercel.json. Long polling getUpdates
 * на стороне приложения должен укладываться в этот лимит — см. README.
 */
const UPSTREAM_TIMEOUT_MS = 55_000

function json(status: number, description: string): Response {
  // Тот же формат, что у Telegram, — клиенту не нужно различать, кто ответил.
  return new Response(JSON.stringify({ ok: false, description }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** Сравнение без ранней остановки — чтобы по времени ответа нельзя было подобрать секрет. */
function secretsMatch(provided: string | null, expected: string): boolean {
  if (provided === null || provided.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return diff === 0
}

export default async function handler(request: Request): Promise<Response> {
  const expectedSecret = process.env.PROXY_SECRET
  if (!expectedSecret) {
    // Лучше не работать вообще, чем работать открытым релеем.
    return json(500, 'PROXY_SECRET не задан в переменных окружения прокси')
  }

  if (!secretsMatch(request.headers.get('x-telegram-proxy-secret'), expectedSecret)) {
    return json(401, 'Неверный секрет прокси')
  }

  if (request.method !== 'POST') {
    return json(405, 'Только POST')
  }

  const { pathname } = new URL(request.url)
  if (!BOT_API_PATH.test(pathname)) {
    return json(404, 'Путь не похож на метод Bot API')
  }

  let upstream: Response
  try {
    upstream = await fetch(`${UPSTREAM}${pathname}`, {
      method: 'POST',
      headers: {
        'content-type': request.headers.get('content-type') ?? 'application/json',
      },
      // Тела у Bot API маленькие (JSON на пару килобайт) — читаем целиком,
      // чтобы не возиться с потоковой передачей и её типами.
      body: await request.text(),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return json(502, `Telegram недоступен: ${reason}`)
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
      'cache-control': 'no-store',
    },
  })
}
