/**
 * Запуск, остановка и склейка процессов FFmpeg.
 *
 * Здесь сосредоточено всё, что связано с жизнью дочерних процессов: порядок
 * сигналов при остановке и сторожевые таймеры склейки. Оба механизма отвечают
 * за уже исправленные баги (обрезанные файлы, потеря часовой записи), поэтому
 * комментарии внутри важнее самого кода.
 */

import { spawn, type ChildProcess } from 'child_process'
import { existsSync, statSync } from 'fs'
import { recordingConfig } from '../config'
import { buildComposeArgs, buildInputFfmpegArgs } from './ffmpeg-args'
import { MIN_USABLE_FILE_BYTES } from './layout'
import type { RecordingInput, RecordingSession } from './types'

export function startInputFfmpeg(session: RecordingSession, input: RecordingInput): ChildProcess {
  const args = buildInputFfmpegArgs(input)
  console.log(`[Recorder] Starting FFmpeg [${input.label}]:`, recordingConfig.ffmpegPath, args.join(' '))

  const ffmpeg = spawn(recordingConfig.ffmpegPath, args)

  ffmpeg.stderr?.on('data', (data: Buffer) => {
    const text = data.toString().trim()
    if (text) console.log(`[Recorder] FFmpeg [${session.id}/${input.label}]: ${text}`)
  })

  ffmpeg.on('close', (code) => {
    console.log(`[Recorder] FFmpeg [${session.id}/${input.label}] exited with code ${code}`)
  })

  ffmpeg.on('error', (error) => {
    console.error(`[Recorder] FFmpeg [${session.id}/${input.label}] error:`, error)
  })

  return ffmpeg
}

/**
 * Дорожка пригодна для склейки, только если FFmpeg реально что-то записал.
 * Размер логируем всегда: пустая дорожка молча выпадает из склейки, и без
 * этой строки "звука нет" выглядит как необъяснимое поведение.
 */
export function hasUsableData(input: RecordingInput): boolean {
  try {
    const size = existsSync(input.rawPath) ? statSync(input.rawPath).size : 0
    const usable = size >= MIN_USABLE_FILE_BYTES
    console.log(
      `[Recorder] Track ${input.label}: ${size} bytes -> ${usable ? 'usable' : 'EMPTY (dropped)'}`,
    )
    return usable
  } catch {
    console.warn(`[Recorder] Track ${input.label}: cannot stat ${input.rawPath}`)
    return false
  }
}

/**
 * ЭТО ПРИЧИНА ОБРЕЗАННЫХ ФАЙЛОВ И ЧЁРНОЙ ПОЛОВИНЫ КАНВАСА.
 *
 * Раньше killTimer вызывал resolve() СРАЗУ после отправки SIGKILL, не дожидаясь
 * события 'close'. Из-за этого stopInputProcesses завершался, пока процессы
 * ещё умирали, и hasUsableData мерил файлы до того, как FFmpeg сбросил буферы
 * и дописал контейнер.
 *
 * В логах это видно буквально: строки "Track a-video: ... bytes" напечатаны
 * РАНЬШЕ, чем "FFmpeg [a-video] exited with code null". Размеры при этом
 * оказались точными кратными 64 КБ (786432 = 12x65536, 3407872 = 52x65536) -
 * то есть на диск попали только целые блоки буфера, а хвост потерялся. Отсюда
 * же "File ended prematurely" на склейке: SIGKILL не даёт дописать ни данные,
 * ни индекс.
 *
 * Дальше это превращалось в симптом "у врача видео кончилось раньше": его
 * дорожка обрезана сильнее (768 КБ против 3.3 МБ у пациента), а в фильтре
 * стоит eof_action=pass:repeatlast=0 - после EOF окно перестаёт
 * дорисовываться и обнажает чёрный базовый слой.
 *
 * Теперь эскалация "q" -> SIGINT -> SIGKILL, и resolve() происходит ТОЛЬКО по
 * 'close'. SIGINT выбран вместо SIGTERM осознанно: FFmpeg обрабатывает его как
 * штатное прерывание и дописывает контейнер.
 */
export function stopInputProcess(session: RecordingSession, input: RecordingInput): Promise<void> {
  const ffmpeg = input.ffmpeg
  if (!ffmpeg || ffmpeg.exitCode !== null || ffmpeg.signalCode !== null) return Promise.resolve()

  return new Promise<void>((resolve) => {
    const timers: NodeJS.Timeout[] = []
    let settled = false

    const finish = (): void => {
      if (settled) return
      settled = true
      for (const timer of timers) clearTimeout(timer)
      resolve()
    }

    const isAlive = (): boolean => ffmpeg.exitCode === null && ffmpeg.signalCode === null

    const later = (ms: number, fn: () => void): void => {
      const timer = setTimeout(fn, ms)
      timer.unref()
      timers.push(timer)
    }

    // Файл дописан - только теперь можно мерить размер.
    ffmpeg.once('close', finish)

    later(4000, () => {
      if (settled || !isAlive()) return
      console.log(`[Recorder] FFmpeg [${session.id}/${input.label}] ignored "q", sending SIGINT`)
      ffmpeg.kill('SIGINT')
    })

    later(9000, () => {
      if (settled || !isAlive()) return
      console.warn(
        `[Recorder] FFmpeg [${session.id}/${input.label}] did not exit, killing ` +
          '(файл останется недописанным)',
      )
      ffmpeg.kill('SIGKILL')
    })

    // Страховка от вечного зависания: SIGKILL послан на 9-й секунде, 'close'
    // после него приходит за миллисекунды, так что сюда доходить не должно.
    later(12000, () => {
      if (settled) return
      console.error(`[Recorder] FFmpeg [${session.id}/${input.label}] no 'close' after SIGKILL`)
      finish()
    })

    try {
      if (ffmpeg.stdin && ffmpeg.stdin.writable) {
        ffmpeg.stdin.write('q')
        ffmpeg.stdin.end()
      } else {
        ffmpeg.kill('SIGINT')
      }
    } catch {
      ffmpeg.kill('SIGINT')
    }
  })
}

/** Все дорожки останавливаем параллельно, пока RTP ещё идёт. */
export async function stopInputProcesses(session: RecordingSession): Promise<void> {
  await Promise.all(session.inputs.map((input) => stopInputProcess(session, input)))
}

/**
 * Запускает офлайн-склейку и ждёт её завершения.
 *
 * Раньше здесь стоял фиксированный лимит 30 минут, и для часовой консультации
 * он был опасен: склейка перекодирует запись в VP8 (54 000 кадров на час),
 * идёт быстрее реального времени в несколько раз, но при нескольких
 * консультациях одновременно они делят CPU. Упёршись в лимит, процесс
 * получал SIGKILL - и запись пропадала ЦЕЛИКОМ, уже после звонка.
 *
 * Теперь лимита по календарному времени нет. Вместо него две проверки:
 *   - зависание: прогресс не двигался STALL_MS - процесс мёртв, убиваем;
 *   - абсолютный предел: пропорционален длине записи, а не константа.
 * Медленная, но живая склейка доводится до конца.
 */
export function composeSegment(session: RecordingSession, usable: RecordingInput[]): Promise<void> {
  const args = buildComposeArgs(session, usable)
  console.log('[Recorder] Composing:', recordingConfig.ffmpegPath, args.join(' '))

  // Нет прогресса 5 минут - это не медленный кодек, а зависший процесс.
  const STALL_MS = 5 * 60 * 1000
  // Даже на очень загруженной машине склейка укладывается в несколько единиц
  // реального времени записи. 8x + 15 минут запаса - предел, за которым
  // происходящее уже ненормально. Для часа это ~8.25 часа против прежних 30
  // минут, при которых час не имел шансов.
  const HARD_CAP_MS = session.durationSeconds * 8000 + 15 * 60 * 1000

  return new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn(recordingConfig.ffmpegPath, args)
    const startedAt = Date.now()

    let lastProgressAt = Date.now()
    let lastLogAt = 0
    let encodedMs = 0
    let killedReason: string | null = null

    ffmpeg.stderr?.on('data', (data: Buffer) => {
      const text = data.toString().trim()
      if (text) console.log(`[Recorder] Compose [${session.id}]: ${text}`)
    })

    // Читать stdout ОБЯЗАТЕЛЬНО - см. комментарий про -progress в
    // buildComposeArgs. Заодно это и есть наш индикатор живости.
    ffmpeg.stdout?.on('data', (data: Buffer) => {
      lastProgressAt = Date.now()

      const match = /out_time_us=(\d+)/.exec(data.toString())
      if (match) encodedMs = Number(match[1]) / 1000

      // Прогресс приходит дважды в секунду - в лог пишем раз в 30 с, иначе он
      // станет нечитаемым. Зато по нему видно реальную скорость склейки.
      const now = Date.now()
      if (now - lastLogAt >= 30_000) {
        lastLogAt = now
        const wallSeconds = (now - startedAt) / 1000
        const speed = wallSeconds > 0 ? encodedMs / 1000 / wallSeconds : 0
        console.log(
          `[Recorder] Compose [${session.id}]: ` +
            `${Math.round(encodedMs / 1000)}s / ${Math.round(session.durationSeconds)}s ` +
            `(${speed.toFixed(1)}x realtime, ${Math.round(wallSeconds)}s elapsed)`,
        )
      }
    })

    const watchdog = setInterval(() => {
      if (ffmpeg.exitCode !== null || ffmpeg.signalCode !== null) return

      const idleMs = Date.now() - lastProgressAt
      if (idleMs >= STALL_MS) {
        killedReason = `no progress for ${Math.round(idleMs / 1000)}s`
      } else if (Date.now() - startedAt >= HARD_CAP_MS) {
        killedReason = `exceeded hard cap of ${Math.round(HARD_CAP_MS / 60000)} min`
      }

      if (killedReason) {
        console.error(`[Recorder] Compose [${session.id}] killed: ${killedReason}`)
        ffmpeg.kill('SIGKILL')
      }
    }, 30_000)
    watchdog.unref()

    const cleanup = (): void => clearInterval(watchdog)

    ffmpeg.on('error', (error) => {
      cleanup()
      reject(error)
    })
    ffmpeg.on('close', (code) => {
      cleanup()
      if (code === 0) {
        const wallSeconds = Math.round((Date.now() - startedAt) / 1000)
        console.log(`[Recorder] Compose [${session.id}] finished in ${wallSeconds}s`)
        resolve()
      } else if (killedReason) {
        reject(new Error(`Compose FFmpeg killed: ${killedReason}`))
      } else {
        reject(new Error(`Compose FFmpeg exited with code ${code}`))
      }
    })
  })
}
