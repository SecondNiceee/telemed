import { randomInt } from 'crypto'

/**
 * Алфавит без визуально похожих символов (0/O, 1/l/I): пароль диктуют и
 * переписывают вручную, поэтому неоднозначные знаки только мешают.
 */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Криптостойкий пароль для выдачи организации. */
export function generatePassword(length = 14): string {
  let out = ''
  for (let i = 0; i < length; i++) {
    out += ALPHABET[randomInt(ALPHABET.length)]
  }
  return out
}
