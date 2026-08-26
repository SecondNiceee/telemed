import fs from 'fs'
import path from 'path'

/**
 * Каталог, куда FFmpeg пишет промежуточные файлы записи.
 *
 * РАНЬШЕ ЗДЕСЬ БЫЛ /tmp - И ЭТО БЫЛО ОПАСНО.
 *
 * На боевом сервере `findmnt /tmp` показал tmpfs размером 2001968k, то есть
 * ~1.91 ГиБ, и это ОПЕРАТИВНАЯ ПАМЯТЬ, а не диск. Часовая консультация в пике
 * требует около 2 ГБ (сырые дорожки ~1.3 ГБ живут одновременно с готовым webm
 * ~0.73 ГБ), то есть гарантированно не влезала: FFmpeg получал ENOSPC во время
 * звонка и запись терялась целиком. Попутно эти же гигабайты отбирались у
 * mediasoup и Node, которым память нужна для самого звонка.
 *
 * Значение по умолчанию считается относительно process.cwd() - тем же приёмом,
 * что и MEDIA_DIR в media-dir.ts. Держать записи рядом с каталогом медиа
 * выгодно: перенос готового файла в media превращается в rename внутри одной
 * файловой системы вместо копирования через EXDEV.
 *
 * Переопределяется RECORDING_OUTPUT_DIR (например, отдельным томом под записи).
 */
export const RECORDINGS_DIR = path.isAbsolute(process.env.RECORDING_OUTPUT_DIR || '')
  ? (process.env.RECORDING_OUTPUT_DIR as string)
  : path.resolve(process.cwd(), process.env.RECORDING_OUTPUT_DIR || 'recordings-tmp')

/**
 * Сколько свободного места требовать перед началом записи.
 *
 * 3 ГиБ - это пик часовой консультации (~2 ГБ) плюс запас на вторую, которая
 * может идти параллельно. Настраивается через RECORDING_MIN_FREE_MB.
 */
const MIN_FREE_BYTES = (Number(process.env.RECORDING_MIN_FREE_MB) || 3072) * 1024 * 1024

export function ensureRecordingsDir(): void {
  try {
    fs.mkdirSync(RECORDINGS_DIR, { recursive: true })
    fs.accessSync(RECORDINGS_DIR, fs.constants.W_OK)
  } catch (err) {
    console.error('[recordings] каталог записей непригоден для записи', {
      dir: RECORDINGS_DIR,
      cwd: process.cwd(),
      error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    })
  }
}

/** Свободные байты на файловой системе каталога записей, null - определить не удалось. */
export async function getFreeBytes(): Promise<number | null> {
  try {
    const stats = await fs.promises.statfs(RECORDINGS_DIR)
    return Number(stats.bsize) * Number(stats.bavail)
  } catch (err) {
    console.warn('[recordings] не удалось получить statfs:', err)
    return null
  }
}

/**
 * Проверяет место ПЕРЕД старт��м записи и бросает ошибку, если его мало.
 *
 * Бросать здесь безопасно и намеренно: RecordingController оборачивает
 * startSegment в try/catch, поэтому звонок продолжится без записи. Это лучше
 * прежнего поведения, когда места не хватало на середине разговора и терялась
 * вся запись - причём молча.
 */
export async function assertEnoughFreeSpace(): Promise<void> {
  ensureRecordingsDir()

  const free = await getFreeBytes()
  // statfs не сработал - не блокируем запись из-за самой диагностики.
  if (free === null) return

  const freeMb = Math.round(free / 1024 / 1024)
  const needMb = Math.round(MIN_FREE_BYTES / 1024 / 1024)

  if (free < MIN_FREE_BYTES) {
    throw new Error(
      `Недостаточно места для записи в ${RECORDINGS_DIR}: свободно ${freeMb} МБ, ` +
        `требуется ${needMb} МБ. Часовая консультация занимает в пике ~2 ГБ.`,
    )
  }

  console.log(`[recordings] ${RECORDINGS_DIR}: свободно ${freeMb} МБ (порог ${needMb} МБ)`)
}
