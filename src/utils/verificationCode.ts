import { randomInt } from 'crypto'
import type { Payload } from 'payload'
import { sendVerificationSms } from './sendSms'

/** Время жизни кода — 5 минут */
export const CODE_TTL_MS = 5 * 60 * 1000
/** Повторная отправка не чаще одного раза в 60 секунд */
export const RESEND_COOLDOWN_MS = 60 * 1000
/** Максимум неудачных попыток ввода до необходимости запросить новый код */
export const MAX_ATTEMPTS = 5
/** Длина кода */
export const CODE_LENGTH = 4

/** Генерирует 4-значный код подтверждения */
export function generateCode(): string {
  return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, '0')
}

/**
 * Сколько миллисекунд осталось до разрешённой повторной отправки.
 * 0 — можно отправлять прямо сейчас.
 */
export function getResendWaitMs(sentAt: string | null | undefined): number {
  if (!sentAt) return 0
  const elapsed = Date.now() - new Date(sentAt).getTime()
  if (Number.isNaN(elapsed)) return 0
  return Math.max(0, RESEND_COOLDOWN_MS - elapsed)
}

/**
 * Генерирует новый код, сохраняет его в документе пользователя и отправляет SMS.
 */
export async function issueCodeForUser({
  payload,
  userId,
  phone,
}: {
  payload: Payload
  userId: number | string
  phone: string
}): Promise<void> {
  const code = generateCode()
  const now = new Date()

  await payload.update({
    collection: 'users',
    id: userId,
    data: {
      verificationCode: code,
      verificationCodeExpiresAt: new Date(now.getTime() + CODE_TTL_MS).toISOString(),
      verificationCodeSentAt: now.toISOString(),
      verificationAttempts: 0,
    },
    overrideAccess: true,
  })

  await sendVerificationSms({ phone, code })
}
