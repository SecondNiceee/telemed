'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Клиентская запись консультации (браузер врача).
 *
 * Почему на клиенте: серверная схема (PlainTransport + FFmpeg) требовала
 * синхронизировать 4 независимых RTP-потока, и любой обрыв (выход участника,
 * выключенная камера) ломал контейнер или уводил дорожки в рассинхрон.
 * Здесь синхронизацию обеспечивает сам браузер: canvas и WebAudio отдают
 * MediaRecorder один готовый поток с общей таймлинией, поэтому рассинхрон
 * и битые файлы невозможны в принципе.
 *
 * Поток данных: canvas(2 окна) + WebAudio(микс 2 дорожек) -> MediaRecorder
 * -> чанки каждые 5 с -> POST /api/recording-chunks -> finalize.
 * Чанки уходят по ходу звонка, поэтому при падении вкладки теряется только
 * незакрытый хвост, а не вся запись.
 */

const CHUNK_INTERVAL_MS = 5000
const CANVAS_WIDTH = 1280
const CANVAS_HEIGHT = 480
const PANE_WIDTH = CANVAS_WIDTH / 2
const FPS = 15

const VIDEO_MIME_CANDIDATES = [
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9,opus',
  'video/webm',
]
const AUDIO_MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm']

function pickMimeType(audioOnly: boolean): string | null {
  if (typeof MediaRecorder === 'undefined') return null
  const candidates = audioOnly ? AUDIO_MIME_CANDIDATES : VIDEO_MIME_CANDIDATES
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? null
}

/**
 * Скрытый <video> - источник кадров для canvas. Создаётся ПУСТЫМ: дорожку в
 * него подставляет syncVideoPanes, он же перепривязывает её после
 * переподключения участника.
 */
function createHiddenVideo(): HTMLVideoElement {
  const element = document.createElement('video')
  element.muted = true
  element.autoplay = true
  element.playsInline = true
  return element
}

/**
 * Одно окно записи. trackId - id дорожки, которая реально подставлена в
 * element: по расхождению с текущей дорожкой потока мы и узнаём, что
 * участник переподключился и картинку надо перепривязать.
 */
interface VideoPane {
  key: 'remote' | 'local'
  element: HTMLVideoElement
  trackId: string | null
}

/** Рисует кадр в свою половину канваса с сохранением пропорций (letterbox). */
function drawPane(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  offsetX: number,
): void {
  const { videoWidth, videoHeight } = video
  // Кадра ещё нет (камера выключена или поток не стартовал) - половина
  // остаётся чёрной, но запись продолжается.
  if (!videoWidth || !videoHeight) return

  const scale = Math.min(PANE_WIDTH / videoWidth, CANVAS_HEIGHT / videoHeight)
  const width = videoWidth * scale
  const height = videoHeight * scale
  context.drawImage(
    video,
    offsetX + (PANE_WIDTH - width) / 2,
    (CANVAS_HEIGHT - height) / 2,
    width,
    height,
  )
}

interface UseCallRecorderOptions {
  /** Запись включается только в браузере врача. */
  enabled: boolean
  appointmentId: number
  doctorId: number | null
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  audioOnly: boolean
}

export function useCallRecorder({
  enabled,
  appointmentId,
  doctorId,
  localStream,
  remoteStream,
  audioOnly,
}: UseCallRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null)
  /**
   * Ссылки на source-узлы ОБЯЗАТЕЛЬНЫ. Если узел никуда не сохранён, сборщик
   * мусора Chrome уничтожает его вместе со звуком - именно поэтому запись
   * получалась полностью беззвучной.
   */
  const audioSourcesRef = useRef(new Map<string, MediaStreamAudioSourceNode>())
  const mediaSyncRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const videoPanesRef = useRef<VideoPane[]>([])
  const canvasStreamRef = useRef<MediaStream | null>(null)

  const startedRef = useRef(false)
  const stoppedRef = useRef(false)
  const startedAtRef = useRef(0)
  const chunkIndexRef = useRef(0)
  const uploadQueueRef = useRef<Promise<void>>(Promise.resolve())
  const mimeTypeRef = useRef('video/webm')

  // Значения через ref: stop() должен быть стабильным, чтобы его можно было
  // безопасно вызывать из обработчиков выхода и эффекта размонтирования.
  const metaRef = useRef({ appointmentId, doctorId, audioOnly })
  metaRef.current = { appointmentId, doctorId, audioOnly }

  // Актуальные потоки для периодической сверки аудиографа: дорожки могут
  // появляться и заменяться уже после старта записи.
  const streamsRef = useRef({ localStream, remoteStream })
  streamsRef.current = { localStream, remoteStream }

  /**
   * Идемпотентно подключает к микшеру все живые аудиодорожки обоих участников
   * и отбрасывает умершие. Вызывается и при старте, и периодически, потому что
   * дорожка собеседника нередко приходит позже видео, а микрофон врача
   * пересоздаётся при смене сети - в обоих случаях запись иначе теряет звук.
   */
  const syncAudioSources = useCallback(() => {
    const context = audioContextRef.current
    const destination = audioDestinationRef.current
    if (!context || !destination) return

    if (context.state === 'suspended') void context.resume().catch(() => {})

    const sources = audioSourcesRef.current
    const liveTrackIds = new Set<string>()

    for (const stream of [streamsRef.current.localStream, streamsRef.current.remoteStream]) {
      if (!stream) continue
      for (const track of stream.getAudioTracks()) {
        if (track.readyState !== 'live') continue
        liveTrackIds.add(track.id)
        if (sources.has(track.id)) continue
        const source = context.createMediaStreamSource(new MediaStream([track]))
        source.connect(destination)
        sources.set(track.id, source)
        console.log('[CallRecorder] Audio track connected', track.id)
      }
    }

    for (const [trackId, source] of sources) {
      if (liveTrackIds.has(trackId)) continue
      source.disconnect()
      sources.delete(trackId)
    }
  }, [])

  /**
   * Идемпотентно держит в каждом окне АКТУАЛЬНУЮ видеодорожку участника.
   *
   * Зачем это нужно. При переподключении сокета useMediasoup закрывает
   * консюмеры и заводит для собеседника НОВЫЙ MediaStream с новой дорожкой
   * (disconnect -> closeMediaSession -> remoteStreamsRef.clear -> consume).
   * Интерфейс это переживает: ref-callback заново присваивает srcObject на
   * каждом рендере, а autoPlay возобновляет воспроизведение - поэтому на
   * экране картинка не пропадала. Скрытый <video> рекордера так не умел: он
   * оставался с закрытой дорожкой, videoWidth обнулялся, drawPane выходил
   * досрочно, и половина канваса до конца записи была чёрной.
   *
   * Поэтому сверяем дорожку по id и перепривязываем при любой замене, а
   * заодно поднимаем воспроизведение, если элемент встал: открепленный от DOM
   * <video> после подмены дорожки нередко остаётся в paused.
   */
  const syncVideoPanes = useCallback(() => {
    for (const pane of videoPanesRef.current) {
      const stream =
        pane.key === 'remote' ? streamsRef.current.remoteStream : streamsRef.current.localStream
      const track = stream?.getVideoTracks().find((item) => item.readyState === 'live') ?? null

      if (!track) {
        // Камера выключена или поток ещё не пришёл: окно честно чёрное. Сбрасываем
        // trackId, чтобы вернувшаяся дорожка снова привязалась.
        if (pane.trackId !== null) {
          pane.element.srcObject = null
          pane.trackId = null
        }
        continue
      }

      if (pane.trackId !== track.id) {
        // Отдельный MediaStream на дорожку: привязка зависит только от самой
        // дорожки, поэтому замена ловится и когда поток пересоздали, и когда
        // дорожку подменили внутри прежнего потока.
        pane.element.srcObject = new MediaStream([track])
        pane.trackId = track.id
        void pane.element.play().catch(() => {})
        console.log('[CallRecorder] Video pane re-attached', pane.key, track.id)
        continue
      }

      if (pane.element.paused || pane.element.readyState === 0) {
        void pane.element.play().catch(() => {})
      }
    }
  }, [])

  /** Ставит чанк в очередь: порядок загрузки должен совпадать с порядком записи. */
  const enqueueChunk = useCallback((blob: Blob, isLast: boolean) => {
    const { appointmentId: aid, doctorId: did } = metaRef.current
    if (!did || blob.size === 0) return

    const chunkIndex = chunkIndexRef.current
    chunkIndexRef.current += 1

    uploadQueueRef.current = uploadQueueRef.current.then(async () => {
      const form = new FormData()
      form.append('chunk', blob)
      form.append('appointmentId', String(aid))
      form.append('doctorId', String(did))
      form.append('chunkIndex', String(chunkIndex))
      form.append('isLast', String(isLast))
      form.append('mimeType', mimeTypeRef.current)

      try {
        const response = await fetch('/api/recording-chunks', {
          method: 'POST',
          body: form,
          credentials: 'include',
        })
        if (!response.ok) {
          console.error('[CallRecorder] Chunk upload failed', chunkIndex, response.status)
        }
      } catch (error) {
        console.error('[CallRecorder] Chunk upload error', chunkIndex, error)
      }
    })
  }, [])

  /** Освобождает канвас, аудиограф и скрытые video-элементы. */
  const teardown = useCallback(() => {
    if (tickerRef.current) {
      clearInterval(tickerRef.current)
      tickerRef.current = null
    }
    if (mediaSyncRef.current) {
      clearInterval(mediaSyncRef.current)
      mediaSyncRef.current = null
    }
    canvasStreamRef.current?.getTracks().forEach((track) => track.stop())
    canvasStreamRef.current = null
    videoPanesRef.current.forEach((pane) => {
      pane.element.srcObject = null
    })
    videoPanesRef.current = []
    audioSourcesRef.current.forEach((source) => source.disconnect())
    audioSourcesRef.current.clear()
    audioDestinationRef.current = null
    void audioContextRef.current?.close().catch(() => {})
    audioContextRef.current = null
    recorderRef.current = null
  }, [])

  /**
   * Останавливает запись, дожидается отправки всех чанков и финализирует
   * запись на сервере. Вызывать ДО навигации со страницы звонка.
   */
  const stop = useCallback(async () => {
    if (!startedRef.current || stoppedRef.current) return
    stoppedRef.current = true

    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      // Ждём onstop: последний ondataavailable приходит перед ним, поэтому
      // хвост записи гарантированно попадает в очередь загрузки.
      await new Promise<void>((resolve) => {
        recorder.addEventListener('stop', () => resolve(), { once: true })
        try {
          recorder.stop()
        } catch {
          resolve()
        }
      })
    }

    teardown()
    setIsRecording(false)

    await uploadQueueRef.current
    if (chunkIndexRef.current === 0) return

    const { appointmentId: aid, doctorId: did, audioOnly: audio } = metaRef.current
    if (!did) return

    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000))
    try {
      const response = await fetch('/api/recording-chunks/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          appointmentId: aid,
          doctorId: did,
          durationSeconds,
          recordingType: audio ? 'audio' : 'video',
        }),
      })
      if (!response.ok) {
        console.error('[CallRecorder] Finalize failed', response.status)
      }
    } catch (error) {
      console.error('[CallRecorder] Finalize error', error)
    }
  }, [teardown])

  // Старт: нужны оба потока - сегмент записи это созвон, а не ожидание.
  useEffect(() => {
    if (!enabled || !doctorId || startedRef.current) return
    if (!localStream || !remoteStream) return

    const mimeType = pickMimeType(audioOnly)
    if (!mimeType) {
      console.error('[CallRecorder] MediaRecorder is not supported in this browser')
      return
    }

    const audioContext = new AudioContext()
    const destination = audioContext.createMediaStreamDestination()
    audioContextRef.current = audioContext
    audioDestinationRef.current = destination
    void audioContext.resume().catch(() => {})
    syncAudioSources()
    // Сверка раз в секунду: подхватывает аудио собеседника, если оно пришло
    // позже видео, заменённый микрофон после переподключения сети и новую
    // видеодорожку участника после его переподключения. Окна создаются ниже -
    // до этого syncVideoPanes работает по пустому списку.
    mediaSyncRef.current = setInterval(() => {
      syncAudioSources()
      syncVideoPanes()
    }, 1000)

    const recordedTracks: MediaStreamTrack[] = [...destination.stream.getAudioTracks()]

    if (!audioOnly) {
      const canvas = document.createElement('canvas')
      canvas.width = CANVAS_WIDTH
      canvas.height = CANVAS_HEIGHT
      const context = canvas.getContext('2d')
      if (!context) {
        console.error('[CallRecorder] Canvas 2D context is unavailable')
        teardown()
        return
      }

      // Слева собеседник, справа врач - тот же порядок, что в интерфейсе.
      const remotePane: VideoPane = { key: 'remote', element: createHiddenVideo(), trackId: null }
      const localPane: VideoPane = { key: 'local', element: createHiddenVideo(), trackId: null }
      videoPanesRef.current = [remotePane, localPane]
      // Первая привязка сразу, дальше - раз в секунду вместе с аудио.
      syncVideoPanes()

      tickerRef.current = setInterval(() => {
        context.fillStyle = '#000000'
        context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
        drawPane(context, remotePane.element, 0)
        drawPane(context, localPane.element, PANE_WIDTH)
      }, Math.round(1000 / FPS))

      const canvasStream = canvas.captureStream(FPS)
      canvasStreamRef.current = canvasStream
      recordedTracks.push(...canvasStream.getVideoTracks())
    }

    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(new MediaStream(recordedTracks), {
        mimeType,
        videoBitsPerSecond: 1_500_000,
        audioBitsPerSecond: 128_000,
      })
    } catch (error) {
      console.error('[CallRecorder] Failed to create MediaRecorder', error)
      teardown()
      return
    }

    mimeTypeRef.current = mimeType
    recorderRef.current = recorder
    startedRef.current = true
    startedAtRef.current = Date.now()

    recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) enqueueChunk(event.data, recorder.state === 'inactive')
    })
    recorder.addEventListener('error', (event) => {
      console.error('[CallRecorder] MediaRecorder error', event)
    })

    recorder.start(CHUNK_INTERVAL_MS)
    setIsRecording(true)
    console.log('[CallRecorder] Recording started', { appointmentId, mimeType })
  }, [enabled, doctorId, localStream, remoteStream, audioOnly, appointmentId, enqueueChunk, teardown, syncAudioSources, syncVideoPanes])

  // Аварийное закрытие вкладки: чанки уже на сервере, просим финализировать
  // то, что успело дойти. sendBeacon переживает выгрузку страницы.
  useEffect(() => {
    if (!enabled) return

    const handlePageHide = () => {
      if (!startedRef.current || stoppedRef.current || chunkIndexRef.current === 0) return
      stoppedRef.current = true

      const { appointmentId: aid, doctorId: did, audioOnly: audio } = metaRef.current
      if (!did) return

      const payload = JSON.stringify({
        appointmentId: aid,
        doctorId: did,
        durationSeconds: Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)),
        recordingType: audio ? 'audio' : 'video',
      })
      navigator.sendBeacon(
        '/api/recording-chunks/finalize',
        new Blob([payload], { type: 'application/json' }),
      )
    }

    window.addEventListener('pagehide', handlePageHide)
    return () => window.removeEventListener('pagehide', handlePageHide)
  }, [enabled])

  // Страховка на случай размонтирования без явного stop().
  useEffect(() => () => void stop(), [stop])

  return { isRecording, stop }
}
