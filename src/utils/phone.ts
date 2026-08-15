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
 *
 * Два важных для удаления правила:
 *  1. Префикс «+7» в уже отформатированном значении отрезается как строка,
 *     а не как цифра. Раньше он попадал в digits и глушился эвристикой
 *     «убрать ведущую 7/8», из-за чего номера, начинающиеся на 7, ломались.
 *  2. Разделитель добавляется только если за ним есть хотя бы одна цифра.
 *     Раньше на трёх цифрах маска дописывала «)», и Backspace, стирая скобку,
 *     тут же получал её назад — ввод залипал на «+7 (XXX» и не стирался.
 */
export function formatPhoneInput(raw: string): string {
  const trimmed = raw.trim()
  const hasPrefix = trimmed.startsWith('+7')

  let digits = (hasPrefix ? trimmed.slice(2) : trimmed).replace(/\D/g, '')

  // Ввод/вставка без префикса: 8XXXXXXXXXX или 7XXXXXXXXXX — отрезаем код страны.
  // Проверяем именно длину 11, чтобы не съесть первую цифру у 10-значного номера.
  if (!hasPrefix && digits.length === 11 && /^[78]/.test(digits)) {
    digits = digits.slice(1)
  }

  digits = digits.slice(0, 10)

  if (digits.length === 0) return ''

  let result = `+7 (${digits.slice(0, 3)}`
  if (digits.length > 3) result += `) ${digits.slice(3, 6)}`
  if (digits.length > 6) result += `-${digits.slice(6, 8)}`
  if (digits.length > 8) result += `-${digits.slice(8, 10)}`

  return result
}
