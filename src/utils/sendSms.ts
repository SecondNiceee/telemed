/**
 * Обёртка над внешним SMS API.
 *
 * Все настройки берутся из env:
 *   SMS_API_URL  — endpoint отправки (POST)
 *   SMS_API_KEY  — токен авторизации (уходит в заголовок Authorization: Bearer ...)
 *   SMS_SENDER   — имя отправителя (опционально)
 *
 * Если формат вашего API отличается — правится только `sendSms()` ниже.
 */

interface SendSmsOptions {
  /** Номер в формате +7XXXXXXXXXX */
  phone: string
  /** Текст сообщения */
  text: string
}

export async function sendSms({ phone, text }: SendSmsOptions): Promise<void> {
  const apiUrl = process.env.SMS_API_URL
  const apiKey = process.env.SMS_API_KEY
  const sender = process.env.SMS_SENDER

  if (!apiUrl) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMS_API_URL не задан — SMS отправить невозможно')
    }
    // В разработке просто печатаем сообщение в консоль
    console.log(`[sms:dev] ${phone} → ${text}`)
    return
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      phone,
      message: text,
      ...(sender ? { sender } : {}),
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
