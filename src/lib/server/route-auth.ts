import 'server-only'

import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

interface DecodedToken {
  id: number
  email: string
  collection: string
}

/**
 * Достать текущего пациента из cookie `payload-token` в route handler.
 * Подпись токена проверяется — в отличие от хуков коллекций, сюда приходит
 * произвольный внешний запрос.
 */
export async function getUserFromCookies(): Promise<
  { user: DecodedToken; error: null } | { user: null; error: { message: string; status: number } }
> {
  const cookieStore = await cookies()
  const token = cookieStore.get('payload-token')?.value

  if (!token) {
    return { user: null, error: { message: 'Требуется авторизация', status: 401 } }
  }

  const secret = process.env.PAYLOAD_SECRET
  if (!secret) {
    return { user: null, error: { message: 'Ошибка конфигурации сервера', status: 500 } }
  }

  let decoded: DecodedToken
  try {
    decoded = jwt.verify(token, secret) as DecodedToken
  } catch {
    return { user: null, error: { message: 'Недействительный токен', status: 401 } }
  }

  if (decoded.collection !== 'users') {
    return { user: null, error: { message: 'Доступно только пациентам', status: 403 } }
  }

  return { user: decoded, error: null }
}
