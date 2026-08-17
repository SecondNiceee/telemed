const ERROR_MESSAGES_BY_NAME: Record<string, string> = {
  UnverifiedEmail: 'Телефон ещё не подтверждён. Запросите новый код и завершите регистрацию.',
  AuthenticationError: 'Неверный телефон или пароль.',
  Unauthorized: 'Вы не авторизованы. Пожалуйста, войдите в систему.',
  Forbidden: 'У вас нет доступа к этому ресурсу.',
  NotFound: 'Запрашиваемый ресурс не найден.',
  TooManyRequests: 'Слишком много запросов. Попробуйте позже.',
  InternalServerError: 'Произошла ошибка на сервере. Попробуйте позже.',
  NetworkError: 'Ошибка соединения. Проверьте интернет и попробуйте снова.',
}

/**
 * Payload отдаёт часть ошибок аутентификации без поля `name` — только английский
 * текст в `errors[0].message`. Переводим такие сообщения по подстроке.
 */
const ERROR_MESSAGES_BY_TEXT: { match: string; message: string }[] = [
  {
    match: 'email or password provided is incorrect',
    message: 'Неверная почта или пароль.',
  },
  {
    match: 'invalid login credentials',
    message: 'Неверная почта или пароль.',
  },
]

function translateMessage(raw: string): string | undefined {
  const normalized = raw.toLowerCase()
  return ERROR_MESSAGES_BY_TEXT.find(({ match }) => normalized.includes(match))?.message
}

export class ApiError extends Error {
  status: number
  /** Полное тело ответа сервера — например { retryAfter: 42 } */
  data?: unknown

  constructor(status: number, message: string, name?: string, data?: unknown) {
    super(message)
    this.name = name ?? 'ApiError'
    this.status = status
    this.data = data
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const byText = error.message ? translateMessage(error.message) : undefined
    if (byText) return byText
    const byName = ERROR_MESSAGES_BY_NAME[error.name]
    if (byName) return byName
    return error.message || 'Произошла неизвестная ошибка.'
  }
  if (error instanceof Error) {
    return translateMessage(error.message) ?? error.message
  }
  return 'Произошла неизвестная ошибка.'
}
