'use client'

/**
 * Звук и счётчик для инбокса оператора.
 *
 * Звук синтезируется через Web Audio, а не берётся из mp3: файл пришлось бы
 * держать в public/, следить за его весом и лицензией, а нужен один короткий
 * сигнал из двух нот.
 */

let audioContext: AudioContext | null = null

type AudioContextConstructor = typeof AudioContext

function getAudioContextCtor(): AudioContextConstructor | null {
  if (typeof window === 'undefined') return null

  // Обращаемся к глобальному имени, а не к window.AudioContext: в типах DOM
  // это `declare var` на globalThis, свойством интерфейса Window он не описан.
  if (typeof AudioContext !== 'undefined') return AudioContext

  // Префикс для старых Safari, где непрефиксного конструктора ещё нет.
  const legacy = (window as Window & { webkitAudioContext?: AudioContextConstructor })
    .webkitAudioContext
  return legacy ?? null
}

/**
 * Подготовить звук.
 *
 * Браузеры запрещают автозапуск звука до первого действия пользователя, и
 * созданный «просто так» контекст остаётся в состоянии suspended. Поэтому
 * контекст создаётся по первому клику или нажатию клавиши в инбоксе —
 * оператор всё равно взаимодействует со страницей, прежде чем ждать сигнал.
 */
export function primeChime(): void {
  const Ctor = getAudioContextCtor()
  if (!Ctor) return

  if (!audioContext) {
    try {
      audioContext = new Ctor()
    } catch {
      // Аудио может быть недоступно (политика браузера, отсутствие устройства).
      // Инбокс от этого не должен ломаться: останутся счётчик и подсветка.
      return
    }
  }

  if (audioContext.state === 'suspended') void audioContext.resume()
}

/**
 * Короткий двухнотный сигнал о новом обращении.
 *
 * Тише и мягче обычного «бипа»: оператор слышит его весь рабочий день.
 */
export function playChime(): void {
  primeChime()
  const ctx = audioContext
  if (!ctx || ctx.state !== 'running') return

  // Две ноты подряд читаются как «пришло сообщение», одна — как системная
  // ошибка. Частоты соответствуют нотам A5 и E6.
  const notes = [
    { frequency: 880, startAt: 0 },
    { frequency: 1318.5, startAt: 0.12 },
  ]

  for (const note of notes) {
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.value = note.frequency

    const start = ctx.currentTime + note.startAt
    // Плавная атака и затухание: резкий старт даёт щелчок в динамиках.
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(0.12, start + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18)

    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start(start)
    oscillator.stop(start + 0.2)
  }
}

const BASE_TITLE = 'Обращения'

/**
 * Счётчик непрочитанных в заголовке вкладки.
 *
 * Нужен именно в title: оператор держит инбокс в фоновой вкладке, и число в
 * заголовке — единственное, что видно, когда открыт другой сайт.
 */
export function setUnreadTitle(unread: number): void {
  if (typeof document === 'undefined') return
  document.title = unread > 0 ? `(${unread}) ${BASE_TITLE}` : BASE_TITLE
}
