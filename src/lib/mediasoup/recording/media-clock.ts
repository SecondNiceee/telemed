/**
 * Замер моментов старта дорожек и вычисление смещений между ними.
 *
 * Эти две функции - пара: первая измеряет, вторая превращает измерения в
 * -itsoffset для склейки. Именно на них держится вся синхронизация записи,
 * поэтому они лежат вместе, а не рядом со сборкой аргументов FFmpeg.
 */

import type { RecordingInput } from './types'

/**
 * Замер момента старта дорожки через mediasoup trace.
 *
 * Для аудио опорная точка - первый RTP-пакет. Для видео - первый КЛЮЧЕВОЙ
 * КАДР: FFmpeg отбрасывает видеопакеты до него, поэтому файл фактически
 * начинается с keyframe, и именно его надо брать за ноль дорожки.
 * После замера trace отключаем, чтобы не грузить воркер.
 */
export function trackMediaStart(input: RecordingInput): void {
  const traceType = input.kind === 'video' ? 'keyframe' : 'rtp'

  input.consumer.on('trace', (trace: { type: string; timestamp?: number }) => {
    // Раньше здесь стояла проверка startTs !== null. Если mediasoup не дал
    // валидный timestamp, startTs оставался null - и обработчик срабатывал
    // на КАЖДОМ следующем trace, каждый раз перезаписывая startTsFallback.
    // В итоге для аудио (trace на каждый RTP-пакет) в fallback оказывалось
    // время ПОСЛЕДНЕГО пакета вместо первого, и смещения дорожек считались
    // от мусорных значений. Сторожим по fallback: он выставляется всегда.
    if (input.startTsFallback !== null) return
    if (trace.type !== traceType) return

    input.startTs = typeof trace.timestamp === 'number' && trace.timestamp > 0 ? trace.timestamp : null
    input.startTsFallback = Date.now()
    console.log(`[Recorder] ${input.label} media start captured (${traceType})`)

    // Больше trace не нужен.
    input.consumer.enableTraceEvent([]).catch(() => {})
  })

  input.consumer.enableTraceEvent([traceType]).catch((error) => {
    console.warn(`[Recorder] Cannot enable trace for ${input.label}:`, error)
  })
}

/**
 * Смещения дорожек в секундах относительно самой ранней из них.
 * Используем trace-часы mediasoup, если они есть у ВСЕХ дорожек (иначе
 * единицы измерения смешались бы), иначе часы Node, иначе нули.
 */
export function computeOffsets(inputs: RecordingInput[]): Map<RecordingInput, number> {
  const offsets = new Map<RecordingInput, number>()

  const pickClock = (): ((input: RecordingInput) => number) | null => {
    if (inputs.every((i) => i.startTs !== null)) return (i) => i.startTs as number
    if (inputs.every((i) => i.startTsFallback !== null)) return (i) => i.startTsFallback as number
    return null
  }

  const clock = pickClock()
  if (!clock) {
    console.warn('[Recorder] No common clock for all tracks - composing without offsets')
    for (const input of inputs) offsets.set(input, 0)
    return offsets
  }

  const base = Math.min(...inputs.map(clock))
  for (const input of inputs) {
    // Отрицательных смещений быть не может: base - минимум.
    const offsetSeconds = Math.max(0, (clock(input) - base) / 1000)
    offsets.set(input, Number(offsetSeconds.toFixed(3)))
  }
  return offsets
}
