import fs from 'fs/promises'
import path from 'path'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * Общая логика сборки клиентской записи звонка из чанков.
 *
 * Запись ведёт браузер врача (src/hooks/use-call-recorder.ts): каждые
 * CHUNK_INTERVAL_MS он отправляет очередной кусок WebM в
 * POST /api/recording-chunks, где тот ложится в CHUNKS_DIR. Склейка и
 * создание документа call-recordings происходят один раз, в конце.
 *
 * Финализацию могут инициировать ДВА независимых источника:
 *
 *  1. сам клиент - POST /api/recording-chunks/finalize (штатный путь: врач
 *     завершил звонок либо закрыл вкладку и успел отправить sendBeacon);
 *  2. фоновый сборщик startOrphanedRecordingsSweeper - если клиент умер
 *     внезапно (краш браузера, потеря питания, force quit) и finalize не
 *     пришёл вовсе. Без него чанки оставались бы в CHUNKS_DIR навсегда:
 *     данные на диске есть, но склеить их некому, и записи в системе
 *     не появлялось совсем.
 *
 * Поэтому finalizeRecordingSession обязана быть идемпотентной - см. блокировку
 * через lock-файл внутри.
 */

export const CHUNKS_DIR = '/tmp/recording-chunks'

/**
 * Шаг нарезки в браузере. Должен совпадать с CHUNK_INTERVAL_MS в
 * src/hooks/use-call-recorder.ts: сборщик оценивает по нему длительность
 * записи, когда клиент не успел прислать точное значение.
 */
export const CHUNK_INTERVAL_MS = 5000

/** Молчание дольше этого срока = клиент мёртв, сессию добираем сами. */
const STALE_SESSION_MS = 2 * 60_000

/** Как часто сборщик проверяет CHUNKS_DIR. */
const SWEEP_INTERVAL_MS = 60_000

/**
 * После этого срока безнадёжную сессию удаляем без склейки.
 *
 * Нужно, чтобы битые или осиротевшие чанки (например, запись удалённой
 * консультации, для которой create всегда падает по внешнему ключу) не
 * копились в /tmp вечно, вызывая ошибку на каждом тике.
 */
const ABANDONED_SESSION_MS = 6 * 60 * 60_000

/** Живой lock старше этого срока считаем брошенным (процесс упал во время склейки). */
const STALE_LOCK_MS = 30 * 60_000

export interface SessionMeta {
  appointmentId: number
  doctorId: number
  chunks: number[]
  mimeType: string
  createdAt?: string
  updatedAt?: string
}

export function getSessionId(appointmentId: number, doctorId: number): string {
  return `${appointmentId}_${doctorId}`
}

function metaPathFor(sessionId: string): string {
  return path.join(CHUNKS_DIR, `${sessionId}_meta.json`)
}

function lockPathFor(sessionId: string): string {
  return path.join(CHUNKS_DIR, `${sessionId}.lock`)
}

export async function readSessionMeta(sessionId: string): Promise<SessionMeta | null> {
  try {
    const raw = await fs.readFile(metaPathFor(sessionId), 'utf-8')
    return JSON.parse(raw) as SessionMeta
  } catch {
    return null
  }
}

/**
 * Захватить исключительное право на финализацию сессии.
 *
 * Клиентский finalize и фоновый сборщик могут сойтись на одной сессии
 * (например, beacon дошёл ровно в момент тика). Без блокировки получилось бы
 * ДВЕ записи одной консультации. Флаг 'wx' - атомарное создание: если файл
 * уже есть, вызов падает с EEXIST, и второй претендент просто уходит.
 */
async function acquireLock(sessionId: string): Promise<boolean> {
  const lockPath = lockPathFor(sessionId)
  try {
    await fs.writeFile(lockPath, String(process.pid), { flag: 'wx' })
    return true
  } catch {
    // Lock есть. Если он давно не обновлялся - процесс, который его взял,
    // умер во время склейки; забираем сессию себе.
    try {
      const stat = await fs.stat(lockPath)
      if (Date.now() - stat.mtimeMs > STALE_LOCK_MS) {
        await fs.writeFile(lockPath, String(process.pid))
        return true
      }
    } catch {
      // Lock исчез между попытками - пусть повторит следующий тик.
    }
    return false
  }
}

async function releaseLock(sessionId: string): Promise<void> {
  await fs.unlink(lockPathFor(sessionId)).catch(() => {})
}

/**
 * Удалить чанки, метаданные и lock сессии.
 *
 * Метаданные сносим ПЕРВЫМИ: пока файл на месте, сборщик считает сессию живой.
 * Если процесс упадёт между удалением чанков и удалением меты, сборщик потом
 * попытается склеить сессию заново и создаст дубль записи. Обратный порядок
 * такого окна не оставляет: без меты сессии для сборщика не существует.
 */
export async function cleanupSession(sessionId: string, chunks: number[]): Promise<void> {
  await fs.unlink(metaPathFor(sessionId)).catch(() => {})
  await Promise.all(
    chunks.map((index) =>
      fs.unlink(path.join(CHUNKS_DIR, `${sessionId}_${index}.webm`)).catch(() => {}),
    ),
  )
  await releaseLock(sessionId)
}

export type FinalizeResult =
  | { status: 'created'; recordingId: number; mediaId: number }
  | { status: 'no-chunks' }
  | { status: 'busy' }
  | { status: 'already-exists' }

interface FinalizeArgs {
  appointmentId: number
  doctorId: number
  /** Точная длительность от клиента. Без неё оцениваем по числу чанков. */
  durationSeconds?: number
  recordingType?: 'video' | 'audio'
}

/**
 * Склеить чанки сессии в один файл и создать документ call-recordings.
 *
 * Идемпотентна: повторный вызов для уже собранной сессии вернёт 'no-chunks'
 * (файлы удалены), а параллельный - 'busy'.
 */
export async function finalizeRecordingSession({
  appointmentId,
  doctorId,
  durationSeconds,
  recordingType,
}: FinalizeArgs): Promise<FinalizeResult> {
  const sessionId = getSessionId(appointmentId, doctorId)

  const meta = await readSessionMeta(sessionId)
  if (!meta || meta.chunks.length === 0) {
    // Раньше этот выход был полностью молчаливым, и «запись не появилась»
    // выглядело в логах ровно так же, как успех.
    console.warn('[RecordingChunks] No chunks to finalize:', sessionId, {
      hasMeta: Boolean(meta),
      chunks: meta?.chunks.length ?? 0,
    })
    return { status: 'no-chunks' }
  }

  if (!(await acquireLock(sessionId))) {
    console.log('[RecordingChunks] Session already being finalized:', sessionId)
    return { status: 'busy' }
  }

  try {
    /**
     * Метаданные могли измениться, пока брали lock.
     *
     * Если файл меты исчез - сессию уже забрал и собрал другой вызов
     * (cleanupSession сносит мету первой), и продолжать нельзя: получился бы
     * дубль. Раньше на этом месте стояла проверка «есть ли уже запись у этой
     * консультации», и она удаляла чанки ЛЮБОГО повторного звонка по той же
     * консультации - второй созвон (например, после обрыва связи) молча
     * пропадал. Lock + отсутствие меты дают ту же защиту от дублей, но не
     * теряют данные.
     */
    const fresh = await readSessionMeta(sessionId)
    if (!fresh || fresh.chunks.length === 0) {
      console.log('[RecordingChunks] Session vanished while acquiring lock:', sessionId)
      return { status: 'already-exists' }
    }

    const payload = await getPayload({ config })

    const buffers: Buffer[] = []
    for (const index of fresh.chunks) {
      try {
        buffers.push(await fs.readFile(path.join(CHUNKS_DIR, `${sessionId}_${index}.webm`)))
      } catch (error) {
        console.error('[RecordingChunks] Failed to read chunk', index, error)
      }
    }
    if (buffers.length === 0) return { status: 'no-chunks' }

    const combined = Buffer.concat(buffers)
    const mimeType = fresh.mimeType || 'video/webm'
    // Тип записи выводим из mimeType: аудиозвонок пишется как audio/webm.
    const resolvedType: 'video' | 'audio' =
      recordingType ?? (mimeType.startsWith('audio/') ? 'audio' : 'video')

    // Два create разделены собственными catch: раньше любая ошибка тут
    // всплывала одним безликим «Failed to finalize recording», и было не
    // видно, упала загрузка файла или запись в БД.
    let mediaDoc: { id: number }
    try {
      mediaDoc = await payload.create({
        collection: 'media',
        data: { alt: `Запись консультации #${appointmentId}` },
        file: {
          data: combined,
          mimetype: mimeType,
          name: `consultation-${appointmentId}-${Date.now()}.webm`,
          size: combined.length,
        },
      })
    } catch (error) {
      console.error('[RecordingChunks] MEDIA create failed', {
        sessionId,
        mimeType,
        bytes: combined.length,
        error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      })
      throw error
    }

    let recording: { id: number }
    try {
      recording = await payload.create({
        collection: 'call-recordings',
        data: {
          appointment: appointmentId,
          doctor: doctorId,
          video: mediaDoc.id,
          // Клиент не успел прислать точную длительность (умер внезапно) -
          // оцениваем по количеству чанков, погрешность в пределах одного шага.
          durationSeconds:
            durationSeconds ??
            Math.max(1, Math.round((fresh.chunks.length * CHUNK_INTERVAL_MS) / 1000)),
          recordedAt: new Date().toISOString(),
          recordingType: resolvedType,
        },
      })
    } catch (error) {
      // Самая частая причина здесь - таблицы call_recordings (или колонки
      // recording_type) нет в проде: postgresAdapter делает авто-push схемы
      // ТОЛЬКО при NODE_ENV !== 'production', а миграции на этот случай в
      // src/migrations нет. Файл при этом уже загружен и лежит в media.
      console.error('[RecordingChunks] CALL-RECORDING create failed', {
        sessionId,
        mediaId: mediaDoc.id,
        hint: 'проверьте pnpm migrate:status и наличие таблицы call_recordings',
        error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      })
      throw error
    }

    console.log('[RecordingChunks] Recording created:', {
      sessionId,
      recordingId: recording.id,
      chunks: fresh.chunks.length,
      bytes: combined.length,
    })

    await cleanupSession(sessionId, fresh.chunks)
    return { status: 'created', recordingId: recording.id, mediaId: mediaDoc.id }
  } finally {
    // cleanupSession снимает lock сам, но при ошибке склейки он остался бы
    // висеть и блокировал бы повторные попытки.
    await releaseLock(sessionId)
  }
}

/** Найти сессии, по которым давно нет новых чанков. */
async function findStaleSessions(): Promise<{ meta: SessionMeta; ageMs: number }[]> {
  let entries: string[]
  try {
    entries = await fs.readdir(CHUNKS_DIR)
  } catch {
    // Каталога ещё нет - записей не было.
    return []
  }

  const result: { meta: SessionMeta; ageMs: number }[] = []
  for (const entry of entries) {
    if (!entry.endsWith('_meta.json')) continue

    const sessionId = entry.slice(0, -'_meta.json'.length)
    const meta = await readSessionMeta(sessionId)
    if (!meta?.appointmentId || !meta.doctorId || !meta.chunks?.length) continue

    // updatedAt пишет роут приёма чанков; если его нет - берём mtime файла.
    let lastActivity = meta.updatedAt ? Date.parse(meta.updatedAt) : Number.NaN
    if (Number.isNaN(lastActivity)) {
      try {
        lastActivity = (await fs.stat(metaPathFor(sessionId))).mtimeMs
      } catch {
        continue
      }
    }

    const ageMs = Date.now() - lastActivity
    if (ageMs >= STALE_SESSION_MS) result.push({ meta, ageMs })
  }
  return result
}

/**
 * Запустить фоновую доборку записей, которые клиент не финализировал.
 *
 * Вызывать ТОЛЬКО из onInit в src/payload.config.ts - по тем же причинам, что
 * и startExpiredHoldsSweeper (см. комментарий там): onInit срабатывает ровно
 * один раз на процесс.
 *
 * @returns функция остановки таймера
 */
export function startOrphanedRecordingsSweeper(): () => void {
  let running = false

  const tick = async () => {
    if (running) return
    running = true

    try {
      for (const { meta, ageMs } of await findStaleSessions()) {
        const sessionId = getSessionId(meta.appointmentId, meta.doctorId)

        if (ageMs >= ABANDONED_SESSION_MS) {
          console.warn('[recordings-sweeper] dropping abandoned session:', sessionId)
          await cleanupSession(sessionId, meta.chunks)
          continue
        }

        try {
          const result = await finalizeRecordingSession({
            appointmentId: meta.appointmentId,
            doctorId: meta.doctorId,
          })
          if (result.status === 'created') {
            console.log(
              `[recordings-sweeper] recovered orphaned recording ${result.recordingId} (${meta.chunks.length} chunk(s))`,
            )
          }
        } catch (error) {
          console.error('[recordings-sweeper] finalize failed for', sessionId, error)
        }
      }
    } catch (error) {
      console.error('[recordings-sweeper] sweep failed:', error)
    } finally {
      running = false
    }
  }

  const timer = setInterval(tick, SWEEP_INTERVAL_MS)
  // Таймер не должен сам удерживать процесс живым - за это отвечает http-сервер.
  timer.unref()

  // Первый проход с задержкой, чтобы не конкурировать с прогревом приложения.
  const warmup = setTimeout(tick, 30_000)
  warmup.unref()

  return () => {
    clearInterval(timer)
    clearTimeout(warmup)
  }
}
