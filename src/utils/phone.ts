/**
 * Утилиты для работы с российскими номерами телефона.
 *
 * Телефон — обычное контактное поле профиля (`users.phone`), логин — email.
 * Канонический формат хранения в БД: +7XXXXXXXXXX
 */

/** Строгий формат хранения номера */
export const PHONE_STORAGE_REGEX = /^\+7\d{10}$/

/**
 * Приводит произвольный ввод к формату +7XXXXXXXXXX.
 * Принимает: 89991234567, 79991234567, 9991234567, +7 (999) 123-45-67 и т.п.
 * Возвращает null, если номер не похож на российский.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null

  let digits = raw.replace(/\D/g, '')

  if (digits.length === 11 && (digits.startsWith('8') || digits.startsWith('7'))) {
    digits = digits.slice(1)
  }

  if (digits.length !== 10) return null

  return `+7${digits}`
}

/** Форматирует номер для отображения: +7 (999) 123-45-67 */
export function formatPhone(phone: string | null | undefined): string {
  const normalized = normalizePhone(phone)
  if (!normalized) return phone ?? ''

  const d = normalized.slice(2)
  return `+7 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8, 10)}`
}

/**
 * Маска для поля ввода: возвращает частично отформатированную строку,
 * пока пользователь печатает.
 */
export function formatPhoneInput(raw: string): string {
  let digits = raw.replace(/\D/g, '')

  if (digits.startsWith('8') || digits.startsWith('7')) {
    digits = digits.slice(1)
  }
  digits = digits.slice(0, 10)

  if (digits.length === 0) return ''

  let result = '+7'
  if (digits.length > 0) result += ` (${digits.slice(0, 3)}`
  if (digits.length >= 3) result += ')'
  if (digits.length > 3) result += ` ${digits.slice(3, 6)}`
  if (digits.length > 6) result += `-${digits.slice(6, 8)}`
  if (digits.length > 8) result += `-${digits.slice(8, 10)}`

  return result
}
