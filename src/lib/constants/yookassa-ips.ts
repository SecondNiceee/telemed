/**
 * Диапазоны, из которых ЮKassa отправляет HTTP-уведомления.
 *
 * Уведомление приходит на открытый эндпоинт и подписи не имеет, поэтому
 * проверка IP — единственный дешёвый фильтр отправителя. Он НЕ является
 * доказательством: обработчик всё равно перечитывает платёж через API
 * (`getPayment`) и не доверяет статусу из тела запроса.
 *
 * Список из документации: https://yookassa.ru/developers/using-api/webhooks
 * При изменении списка на стороне ЮKassa его можно переопределить через
 * переменную окружения YOOKASSA_NOTIFICATION_IPS (значения через запятую),
 * не дожидаясь деплоя.
 */
export const YOOKASSA_NOTIFICATION_IPS = [
  '185.71.76.0/27',
  '185.71.77.0/27',
  '77.75.153.0/25',
  '77.75.156.11',
  '77.75.156.35',
  '77.75.154.128/25',
  '2a02:5180::/32',
] as const

/** Актуальный список диапазонов: из окружения, если задан, иначе встроенный. */
export function getYooKassaNotificationIps(): string[] {
  const override = process.env.YOOKASSA_NOTIFICATION_IPS?.trim()

  if (override) {
    const parsed = override
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)

    if (parsed.length > 0) return parsed
  }

  return [...YOOKASSA_NOTIFICATION_IPS]
}
