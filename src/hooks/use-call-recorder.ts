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

/** Скрытый <video>, который служит источником кадров для canvas. */
function createHiddenVideo(stream: MediaStream): HTMLVideoElement {
  const element = document.createElement('video')
  element.srcObject = stream
  element.muted = true
  element.autoplay = true
  element.playsInline = true
  void element.play().catch(() => {})
  return element
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
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const videoElementsRef = useRef<HTMLVideoElement[]>([])
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
    canvasStreamRef.current?.getTracks().forEach((track) => track.stop())
    canvasStreamRef.current = null
    videoElementsRef.current.forEach((element) => {
      element.srcObject = null
    })
    videoElementsRef.current = []
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
    for (const stream of [localStream, remoteStream]) {
      const audioTracks = stream.getAudioTracks()
      if (audioTracks.length === 0) continue
      audioContext.createMediaStreamSource(new MediaStream(audioTracks)).connect(destination)
    }
    void audioContext.resume().catch(() => {})
    audioContextRef.current = audioContext

    const recordedTracks: MediaStreamTrack[] = [...destination.stream.getAudioTracks()]

    if (!audioOnly) {
      const canvas = document.createElement('canvas')
      canvas.width = CANVAS_WIDTH
      canvas.height = CANVAS_HEIGHT
      const context = canvas.getContext('2d')
      if (!context) {
        console.error('[CallRecorder] Canvas 2D context is unavailable')
        void audioContext.close().catch(() => {})
        return
      }

      // Слева собеседник, справа врач - тот же порядок, что в интерфейсе.
      const remoteVideo = createHiddenVideo(remoteStream)
      const localVideo = createHiddenVideo(localStream)
      videoElementsRef.current = [remoteVideo, localVideo]

      tickerRef.current = setInterval(() => {
        context.fillStyle = '#000000'
        context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
        drawPane(context, remoteVideo, 0)
        drawPane(context, localVideo, PANE_WIDTH)
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
  }, [enabled, doctorId, localStream, remoteStream, audioOnly, appointmentId, enqueueChunk, teardown])

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
