export class ApiError extends Error {
  status: number
  code: string

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code ?? getErrorCode(status)
  }
}

export function getErrorCode(status: number): string {
  switch (status) {
    case 400:
      return 'BAD_REQUEST'
    case 401:
      return 'UNAUTHORIZED'
    case 403:
      return 'FORBIDDEN'
    case 404:
      return 'NOT_FOUND'
    case 429:
      return 'TOO_MANY_REQUESTS'
    case 500:
      return 'INTERNAL_SERVER_ERROR'
    default:
      return 'UNKNOWN_ERROR'
  }
}

const ERROR_MESSAGES_BY_NAME: Record<string, string> = {
  UnverifiedEmail:
    'Email ещё не подтверждён. Перейдите по ссылке из письма или пройдите регистрацию повторно.',
  AuthenticationError: 'Неверный email или пароль.',
  UNAUTHORIZED: 'Вы не авторизованы. Пожалуйста, войдите в систему.',
  FORBIDDEN: 'У вас нет доступа к этому ресурсу.',
  NOT_FOUND: 'Запрашиваемый ресурс не найден.',
  TOO_MANY_REQUESTS: 'Слишком много запросов. Попробуйте позже.',
  INTERNAL_SERVER_ERROR: 'Произошла ошибка на сервере. Попробуйте позже.',
  NETWORK_ERROR: 'Ошибка соединения. Проверьте интернет и попробуйте снова.',
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const byName = ERROR_MESSAGES_BY_NAME[error.code]
    if (byName) return byName
    return error.message || 'Произошла неизвестная ошибка.'
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Произошла неизвестная ошибка.'
}
