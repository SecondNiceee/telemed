import 'server-only'

import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { getPayloadJwtSecret } from './payload-jwt-secret'

export type ParticipantCollection = 'users' | 'doctors'
export type ParticipantSession = jwt.JwtPayload & {
  id: number | string
  collection: ParticipantCollection
}

/**
 * Кто открыл страницу или дёрнул маршрут звонка - пациент или врач.
 *
 * У врача и пациента разные cookie (`doctors-token` и `payload-token`), и оба
 * являются полноправными участниками консультации. Логика жила прямо в
 * page.tsx комнаты звонка, но проверка согласия на запись нужна обеим сторонам
 * (пациент отвечает, врач видит ответ), поэтому вынесена в общий модуль:
 * иначе одна из копий со временем разошлась бы с другой.
 *
 * Подпись проверяется всегда: сюда приходит внешний запрос, а не внутренний
 * вызов Payload.
 */
export async function getParticipantSession(): Promise<ParticipantSession | null> {
  const cookieStore = await cookies()
  const candidates = [
    { token: cookieStore.get('doctors-token')?.value, collection: 'doctors' as const },
    { token: cookieStore.get('payload-token')?.value, collection: 'users' as const },
  ]
  const secret = getPayloadJwtSecret()
  if (!secret) return null

  for (const candidate of candidates) {
    if (!candidate.token) continue
    try {
      const decoded = jwt.verify(candidate.token, secret) as ParticipantSession
      if (decoded.collection === candidate.collection) return decoded
    } catch {
      // Пробуем вторую поддерживаемую cookie участника.
    }
  }
  return null
}
