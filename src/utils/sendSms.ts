/**
 * Обёртка над внешним SMS API.
 *
 * Формат запроса:
 *   POST {SMS_API}/api/sms/send
 *   Authorization: Bearer {SMS_API_KEY}
 *   Content-Type: application/json
 *   { "to": "+71234567890", "text": "Код: 123456", "unicode": false }
 *
 * Env (только серверные, без NEXT_PUBLIC — sendSms вызывается лишь из route handlers):
 *   SMS_API      — базовый адрес сервиса, например https://sms.example.com
 *   SMS_API_KEY  — токен авторизации
 */

interface SendSmsOptions {
  /** Номер в формате +7XXXXXXXXXX */
  phone: string
  /** Текст сообщения */
  text: string
  /** Передать true, если сервис должен отправить сообщение как unicode */
  unicode?: boolean
}

export async function sendSms({ phone, text, unicode = false }: SendSmsOptions): Promise<void> {
  const apiBase = process.env.SMS_API
  const apiKey = process.env.SMS_API_KEY

  if (!apiBase) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMS_API не задан — SMS отправить невозможно')
    }
    // В разработке просто печатаем сообщение в консоль
    console.log(`[sms:dev] ${phone} → ${text}`)
    return
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`

  // Убираем возможный слэш на конце, чтобы не получить двойной //api/sms/send
  const endpoint = `${apiBase.replace(/\/+$/, '')}/api/sms/send`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      to: phone,
      text,
      unicode,
    }),
  })

  if (!response.ok) {
    const details = await response.text().catch(() => '')
    console.error(`[sms] Ошибка отправки на ${phone}: ${response.status} ${details}`)
    throw new Error('Не удалось отправить SMS')
  }
}

/** Отправляет SMS с кодом подтверждения регистрации */
export async function sendVerificationSms({
  phone,
  code,
}: {
  phone: string
  code: string
}): Promise<void> {
  await sendSms({
    phone,
    text: `Код подтверждения smartcardio: ${code}. Действителен 5 минут.`,
  })
}
