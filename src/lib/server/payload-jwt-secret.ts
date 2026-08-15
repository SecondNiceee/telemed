import crypto from 'crypto'

/**
 * Секрет, которым Payload реально подписывает JWT в cookie
 * (`payload-token`, `doctors-token`, `organisations-token`).
 *
 * Payload НЕ использует `process.env.PAYLOAD_SECRET` напрямую — при инициализации
 * он выводит из него ключ (см. payload/dist/index.js):
 *
 *   secret = sha256(config.secret).digest('hex').slice(0, 32)
 *
 * Поэтому `jwt.verify(token, process.env.PAYLOAD_SECRET)` всегда падает с
 * `invalid signature`. Используйте эту функцию (или `payload.secret`, если
 * инстанс Payload уже получен в этом же месте).
 */
export function getPayloadJwtSecret(): string | null {
  const raw = process.env.PAYLOAD_SECRET
  if (!raw) return null
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32)
}
