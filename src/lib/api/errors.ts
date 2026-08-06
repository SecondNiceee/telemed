const ERROR_MESSAGES_BY_NAME: Record<string, string> = {
  UnverifiedEmail:
    'Email ещё не подтверждён. Перейдите по ссылке из письма или пройдите регистрацию повторно.',
  AuthenticationError: 'Неверный email или пароль.',
  Unauthorized: 'Вы не авторизованы. Пожалуйста, войдите в систему.',
  Forbidden: 'У вас нет доступа к этому ресурсу.',
  NotFound: 'Запрашиваемый ресурс не найден.',
  TooManyRequests: 'Слишком много запросов. Попробуйте позже.',
  InternalServerError: 'Произошла ошибка на сервере. Попробуйте позже.',
  NetworkError: 'Ошибка соединения. Проверьте интернет и попробуйте снова.',
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string, name?: string) {
    super(message)
    this.name = name ?? 'ApiError'
    this.status = status
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const byName = ERROR_MESSAGES_BY_NAME[error.name]
    if (byName) return byName
    return error.message || 'Произошла неизвестная ошибка.'
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Произошла неизвестная ошибка.'
}
