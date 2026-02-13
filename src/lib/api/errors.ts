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

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'UNAUTHORIZED':
        return 'Вы не авторизованы. Пожалуйста, войдите в систему.'
      case 'FORBIDDEN':
        return 'У вас нет доступа к этому ресурсу.'
      case 'NOT_FOUND':
        return 'Запрашиваемый ресурс не найден.'
      case 'TOO_MANY_REQUESTS':
        return 'Слишком много запросов. Попробуйте позже.'
      case 'INTERNAL_SERVER_ERROR':
        return 'Произошла ошибка на сервере. Попробуйте позже.'
      default:
        return error.message || 'Произошла неизвестная ошибка.'
    }
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Произошла неизвестная ошибка.'
}
