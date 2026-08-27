/**
 * Recording Controller
 *
 * Orchestrates server-side recording around the room lifecycle:
 * - a segment starts when BOTH participants have published their tracks
 * - a segment stops and is finalized when a participant leaves or the room closes
 *
 * One appointment can have many call segments -> many recording files.
 * The segment type (video/audio) is derived from what both sides publish.
 */

import type { Producer } from 'mediasoup/types'
import { recordingConfig, recordingFinalizeConfig } from './config'
import { recorder, type ParticipantProducers, type RecordingSession } from './recorder'
import type { Room } from './room'

const START_DEBOUNCE_MS = 1500

function parseAppointmentId(roomId: string): number | null {
  const match = /^appointment_(\d+)$/.exec(roomId)
  return match ? Number.parseInt(match[1], 10) : null
}

function collectParticipants(room: Room): ParticipantProducers[] {
  const participants: ParticipantProducers[] = []
  for (const [peerId, peer] of room.peers) {
    let audio: Producer | undefined
    let video: Producer | undefined
    for (const producer of peer.producers.values()) {
      if (producer.closed) continue
      if (producer.kind === 'audio' && !audio) audio = producer
      if (producer.kind === 'video' && !video) video = producer
    }
    if (audio) participants.push({ peerId, audio, video })
  }
  return participants
}

class RecordingController {
  private readonly startTimers = new Map<string, NodeJS.Timeout>()
  private readonly finalizing = new Set<string>()
  /** Чтобы не засорять лог отсутствием ffmpeg на каждом продюсере. */
  private warnedMissingFfmpeg = false
  /**
   * Последняя известная Room по id. Нужна, чтобы после разрыва сегмента
   * запустить новый, имея на руках только roomId из колбэка рекордера.
   * Держим здесь, а не через roomManager: room.ts импортирует контроллер,
   * и обратный импорт замкнул бы цикл.
   */
  private readonly rooms = new Map<string, Room>()

  constructor() {
    // Участник переопубликовал дорожки посреди сегмента - закрываем текущий
    // файл и начинаем новый, иначе он выпадет из записи до конца сегмента.
    recorder.onSegmentInterrupted = (roomId, label) => {
      void this.restartSegment(roomId, label)
    }
  }

  /**
   * Закрыть прерванный сегмент и открыть новый на свежих продюсерах.
   */
  private async restartSegment(roomId: string, label: string): Promise<void> {
    console.warn(`[RecordingController] Segment in room ${roomId} interrupted by ${label}, restarting`)
    await this.stopAndFinalize(roomId)

    const room = this.rooms.get(roomId)
    if (!room || room.router.closed) return
    // Через onProducersChanged, а не напрямую: тот же дебаунс даёт
    // переподключившемуся участнику время опубликовать И аудио, И видео,
    // чтобы новый сегмент сразу стал полноценным.
    this.onProducersChanged(room)
  }

  /**
   * Called after any producer is created. Debounced so that a participant's
   * audio and video producers (published back to back) land in one segment.
   */
  onProducersChanged(room: Room): void {
    this.rooms.set(room.id, room)

    // Режим выбирается в src/lib/recording-mode.ts. Остановка и финализация
    // ниже намеренно работают всегда - если сегмент всё же был запущен
    // (режим меняли на ходу), его нужно корректно закрыть.
    if (!recordingConfig.enabled) return
    if (recorder.getActiveRecordingForRoom(room.id)) return

    // Без ffmpeg серверная запись не стартует. Раньше это был молчаливый
    // return: режим 'server' выставлен, консультация прошла, записи нет и в
    // логах ни строчки. Предупреждаем один раз на процесс.
    if (!recorder.checkFfmpegAvailable()) {
      if (!this.warnedMissingFfmpeg) {
        this.warnedMissingFfmpeg = true
        console.error(
          '[RecordingController] RECORDING_MODE=server, но ffmpeg не найден ' +
            `(${recordingConfig.ffmpegPath}). Записи не будет. Установите ffmpeg, ` +
            'задайте FFMPEG_PATH или переключитесь на NEXT_PUBLIC_RECORDING_MODE=client.',
        )
      }
      return
    }

    const existingTimer = this.startTimers.get(room.id)
    if (existingTimer) clearTimeout(existingTimer)

    const timer = setTimeout(() => {
      this.startTimers.delete(room.id)
      void this.tryStartSegment(room)
    }, START_DEBOUNCE_MS)
    timer.unref()
    this.startTimers.set(room.id, timer)
  }

  /** Called when a participant leaves the room. */
  onPeerLeft(room: Room): void {
    this.cancelPendingStart(room.id)
    void this.stopAndFinalize(room.id)
  }

  /** Called right before the room's router is closed. */
  async onRoomClosing(roomId: string): Promise<void> {
    this.cancelPendingStart(roomId)
    await this.stopAndFinalize(roomId)
    this.rooms.delete(roomId)
  }

  private cancelPendingStart(roomId: string): void {
    const timer = this.startTimers.get(roomId)
    if (timer) {
      clearTimeout(timer)
      this.startTimers.delete(roomId)
    }
  }

  /**
   * Дал ли пациент согласие на запись этой консультации.
   *
   * Процесс mediasoup к базе не обращается, поэтому спрашивает Next.js тем же
   * серверным секретом, что и finalize.
   *
   * При любой неопределённости отвечаем «нет»: нет appointmentId, не настроены
   * NEXTJS_URL / секрет, сеть не ответила, код ответа не 200. Запись - данные о
   * здоровье, и «не смогли проверить» не может означать «пишем».
   */
  private async isRecordingAllowed(appointmentId: number | null): Promise<boolean> {
    if (appointmentId === null) return false

    const { nextjsUrl, serverSecret } = recordingFinalizeConfig
    if (!nextjsUrl || !serverSecret) {
      console.warn('[RecordingController] NEXTJS_URL или MEDIASOUP_SERVER_SECRET не заданы, согласие не проверить - запись не начинаем')
      return false
    }

    try {
      const response = await fetch(`${nextjsUrl}/api/mediasoup-recording/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId, serverSecret }),
      })
      if (!response.ok) {
        console.error(`[RecordingController] Проверка согласия вернула ${response.status}, запись не начинаем`)
        return false
      }
      const result = (await response.json()) as { allowed?: boolean; status?: string }
      if (result.allowed !== true) {
        console.log(`[RecordingController] Консультация ${appointmentId}: согласия нет (${result.status ?? 'unknown'}), запись не ведём`)
        return false
      }
      return true
    } catch (error) {
      console.error(`[RecordingController] Не удалось проверить согласие для консультации ${appointmentId}:`, error)
      return false
    }
  }

  private async tryStartSegment(room: Room): Promise<void> {
    if (room.router.closed) return
    if (recorder.getActiveRecordingForRoom(room.id)) return

    const participants = collectParticipants(room)
    // Record only real conversations: both participants publishing audio.
    if (participants.length < 2) return

    // Согласие проверяем до старта сегмента: при отказе файл не создаётся
    // вообще, а не удаляется потом. Проверка здесь, а не в onProducersChanged,
    // чтобы не ходить по сети на каждого продюсера - только когда сегмент
    // реально готов начаться.
    const appointmentId = parseAppointmentId(room.id)
    if (!(await this.isRecordingAllowed(appointmentId))) return

    // Пока шёл запрос, комната могла закрыться или сегмент - начаться.
    if (room.router.closed) return
    if (recorder.getActiveRecordingForRoom(room.id)) return

    try {
      await recorder.startSegment(room.id, room.router, participants[0], participants[1], appointmentId)
    } catch (error) {
      console.error(`[RecordingController] Failed to start segment for room ${room.id}:`, error)
    }
  }

  private async stopAndFinalize(roomId: string): Promise<void> {
    if (this.finalizing.has(roomId)) return
    const active = recorder.getActiveRecordingForRoom(roomId)
    if (!active) return

    this.finalizing.add(roomId)
    try {
      const session = await recorder.stopSegmentByRoom(roomId)
      if (session) await this.finalizeSegment(session)
    } catch (error) {
      console.error(`[RecordingController] Failed to stop recording for room ${roomId}:`, error)
    } finally {
      this.finalizing.delete(roomId)
    }
  }

  /**
   * Upload the finished file into Payload (Media + call-recordings document)
   * via the existing server-to-server finalize endpoint. On failure the file
   * stays on disk for manual recovery.
   */
  private async finalizeSegment(session: RecordingSession): Promise<void> {
    if (session.appointmentId === null) {
      console.warn(`[RecordingController] No appointment id in room ${session.roomId}, skipping finalize`)
      return
    }
    if (session.status !== 'completed') {
      console.warn(`[RecordingController] Segment ${session.id} status is ${session.status}, skipping finalize`)
      return
    }
    // Ignore segments too short to be a meaningful conversation.
    if (session.durationSeconds < 3) {
      console.log(`[RecordingController] Segment ${session.id} too short (${session.durationSeconds}s), skipping`)
      return
    }

    const { nextjsUrl, serverSecret } = recordingFinalizeConfig
    if (!nextjsUrl || !serverSecret) {
      console.warn('[RecordingController] NEXTJS_URL or MEDIASOUP_SERVER_SECRET not set, cannot finalize')
      return
    }

    try {
      const response = await fetch(`${nextjsUrl}/api/mediasoup-recording/finalize-server`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId: session.appointmentId,
          sessionId: session.id,
          durationSeconds: session.durationSeconds,
          recordingType: session.recordingType,
          serverSecret,
        }),
      })

      if (!response.ok) {
        const text = await response.text().catch(() => '')
        console.error(`[RecordingController] Finalize failed (${response.status}): ${text}`)
        return
      }

      console.log(`[RecordingController] Finalized ${session.recordingType} segment ${session.id}`)
    } catch (error) {
      console.error(`[RecordingController] Finalize request failed for ${session.id}:`, error)
    }
  }
}

export const recordingController = new RecordingController()
