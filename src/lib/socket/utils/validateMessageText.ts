// Проверка валидации сообщения
export default function validateMessageText(text: unknown): string | null {
    if (typeof text !== 'string') return null
    const trimmed = text.trim()
    if (trimmed.length === 0) return null
    // Truncate to max 5000 characters
    return trimmed.slice(0, 5000)
  }