/**
 * Помечает приватными уже загруженные файлы, которые до этого были доступны
 * без авторизации.
 *
 * Зачем нужен отдельный запуск. Поле visibility появилось у коллекции media
 * позже самих файлов, поэтому у старых документов значения нет вовсе. Правило
 * доступа считает такие файлы публичными - иначе каталог врачей разом остался
 * бы без фотографий. Но под это же правило попадают и записи консультаций,
 * загруженные раньше: они продолжают открываться всем, пока их не пометить.
 *
 * Скрипт проходит по записям звонков и сообщениям с вложениями и закрывает
 * ровно те файлы, на которые они ссылаются. Остальное (фото врачей, иконки
 * категорий) не трогает.
 *
 * Запуск: pnpm tsx scripts/backfill-media-visibility.ts
 * Повторный запуск безопасен: уже помеченные файлы пропускаются.
 */

import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'

/** Достаёт id из связи, которая может прийти и числом, и объектом. */
function relationId(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value) || null
  if (value && typeof value === 'object' && 'id' in value) {
    return Number((value as { id: unknown }).id) || null
  }
  return null
}

async function backfill() {
  const payload = await getPayload({ config })

  // mediaId -> кому оставляем доступ. Каждая загрузка создаёт свой документ,
  // поэтому один файл принадлежит одной консультации; повторную встречу того
  // же id просто логируем, не перезатирая первое значение.
  const plan = new Map<number, { user: number | null; doctor: number | null }>()

  const remember = (mediaId: number | null, userId: number | null, doctorId: number | null) => {
    if (!mediaId) return
    const existing = plan.get(mediaId)
    if (existing) {
      if (existing.user !== userId || existing.doctor !== doctorId) {
        console.warn(
          `  файл ${mediaId} упомянут дважды с разными участниками - оставляю первых (пациент ${existing.user}, врач ${existing.doctor})`,
        )
      }
      return
    }
    plan.set(mediaId, { user: userId, doctor: doctorId })
  }

  console.log('Считаю записи консультаций...')
  const recordings = await payload.find({
    collection: 'call-recordings',
    limit: 0, // 0 = без ограничения
    depth: 1, // нужен appointment.user
    overrideAccess: true,
  })

  for (const rec of recordings.docs) {
    const appointment = rec.appointment as unknown
    const patientId =
      appointment && typeof appointment === 'object' && 'user' in appointment
        ? relationId((appointment as { user: unknown }).user)
        : null
    remember(relationId(rec.video), patientId, relationId(rec.doctor))
  }
  console.log(`  записей: ${recordings.docs.length}`)

  console.log('Считаю вложения чатов...')
  const messages = await payload.find({
    collection: 'messages',
    where: { attachment: { exists: true } },
    limit: 0,
    depth: 1, // нужен appointment.user и appointment.doctor
    overrideAccess: true,
  })

  for (const msg of messages.docs) {
    const appointment = msg.appointment as unknown
    if (!appointment || typeof appointment !== 'object') continue
    const patientId = relationId((appointment as { user?: unknown }).user)
    const doctorId = relationId((appointment as { doctor?: unknown }).doctor)
    remember(relationId(msg.attachment), patientId, doctorId)
  }
  console.log(`  сообщений с вложениями: ${messages.docs.length}`)

  console.log(`\nНужно закрыть файлов: ${plan.size}`)

  let updated = 0
  let skipped = 0
  let failed = 0

  for (const [mediaId, allowed] of plan) {
    try {
      const current = await payload.findByID({
        collection: 'media',
        id: mediaId,
        depth: 0,
        overrideAccess: true,
      })

      if ((current as { visibility?: string }).visibility === 'private') {
        skipped++
        continue
      }

      await payload.update({
        collection: 'media',
        id: mediaId,
        data: {
          visibility: 'private',
          allowedUser: allowed.user,
          allowedDoctor: allowed.doctor,
        },
        overrideAccess: true,
      })
      updated++
    } catch (error) {
      failed++
      console.error(`  файл ${mediaId}: ошибка`, error instanceof Error ? error.message : error)
    }
  }

  console.log(`\nЗакрыто: ${updated}, уже были закрыты: ${skipped}, ошибок: ${failed}`)

  if (failed > 0) {
    // Ненулевой код, чтобы сбой был заметен в CI и в ручном запуске.
    process.exit(1)
  }
}

backfill()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Скрипт упал:', error)
    process.exit(1)
  })
