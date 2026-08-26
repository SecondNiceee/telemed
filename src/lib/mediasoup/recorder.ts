/**
 * MediaSoup Recorder
 *
 * Серверная запись через PlainTransport + FFmpeg. Записывает ОБОИХ участников
 * звонка в один WebM:
 * - видеозвонок: два окна рядом + смикшированное аудио
 * - аудиозвонок: только смикшированное аудио
 *
 * АРХИТЕКТУРА (важно для понимания правок).
 *
 * Раньше все 4 RTP-потока (2 видео + 2 аудио) отдавались ОДНОМУ процессу
 * FFmpeg через общий SDP. Это и было корнем всех проблем: SDP-демуксер
 * пытался свести четыре независимые RTP-таймлинии в один контейнер, зажимал
 * "немонотонные" DTS, выбрасывал интервалы, и дорожки неизбежно разъезжались
 * (чёрный экран в начале, звук короче видео, рассинхрон).
 *
 * Теперь: ОДИН ПОТОК = ОДИН ПРОЦЕСС FFmpeg = ОДИН ФАЙЛ.
 *
 * Этап 1 (во время звонка): 4 независимых FFmpeg, у каждого свой SDP ровно с
 * одной m=-секцией. Задача каждого тривиальна - принять один поток и писать
 * его в файл с -c copy. Межпотоковой синхронизации внутри FFmpeg нет вообще,
 * поэтому ломаться нечему. Node при этом фиксирует момент старта каждой
 * дорожки (mediasoup trace: первый RTP-пакет для аудио, первый ключевой кадр
 * для видео - именно с него FFmpeg начинает писать видеофайл).
 *
 * Этап 2 (после звонка): офлайн-склейка. Мы САМИ задаём смещения дорожек
 * через -itsoffset на основе замеров этапа 1. Синхронизация становится
 * детерминированной: ею управляем мы, а не демуксер FFmpeg.
 *
 * СТРУКТУРА. Этот файл - оркестратор: он владеет сессиями, создаёт входы и
 * ведёт сегмент от старта до склейки. Детали вынесены в ./recording:
 * - ffmpeg-args      сборка SDP и аргументов (чистые функции)
 * - process-lifecycle запуск/остановка процессов и склейка
 * - media-clock      замер старта дорожек и смещения между ними
 * - port-pool        выделение RTP-портов
 * - layout, types    геометрия кадра и общие типы
 */

import { execSync } from 'child_process'
import { writeFile, unlink } from 'fs/promises'
import path from 'path'
import { recordingConfig, plainTransportOptions } from './config'
import { assertEnoughFreeSpace, getFreeBytes } from '../recordings-dir'
import { generateSdp } from './recording/ffmpeg-args'
import { KEYFRAME_RECOVERY_INTERVAL_MS } from './recording/layout'
import { trackMediaStart } from './recording/media-clock'
import { PortPool } from './recording/port-pool'
import {
  composeSegment,
  hasUsableData,
  startInputFfmpeg,
  stopInputProcesses,
} from './recording/process-lifecycle'
import type {
  ParticipantProducers,
  Producer,
  RecordingInput,
  RecordingSession,
  Router,
} from './recording/types'

// Публичная поверхность модуля не изменилась: потребители (RecordingController)
// по-прежнему берут и recorder, и типы сессии из этого файла.
export type { ParticipantProducers, RecordingSession } from './recording/types'

class Recorder {
  private readonly sessions = new Map<string, RecordingSession>()
  private readonly ports = new PortPool()
  private ffmpegAvailable: boolean | null = null

  /**
   * Вызывается, когда участник переопубликовал дорожки посреди сегмента.
   * Подписчик (RecordingController) закрывает текущий сегмент и открывает
   * новый - уже на свежих продюсерах.
   */
  onSegmentInterrupted: ((roomId: string, label: string) => void) | null = null

  checkFfmpegAvailable(): boolean {
    if (this.ffmpegAvailable !== null) return this.ffmpegAvailable
    try {
      execSync(`${recordingConfig.ffmpegPath} -version`, { stdio: 'ignore' })
      this.ffmpegAvailable = true
      console.log('[Recorder] FFmpeg is available')
    } catch {
      this.ffmpegAvailable = false
      console.warn('[Recorder] FFmpeg is NOT available - recording disabled')
    }
    return this.ffmpegAvailable
  }

  /**
   * Pipe one producer to FFmpeg: PlainTransport consumes the producer and
   * sends RTP to 127.0.0.1:<rtpPort> where FFmpeg is listening (per SDP).
   */
  private async createInput(
    session: RecordingSession,
    router: Router,
    producer: Producer,
    slot: 0 | 1,
  ): Promise<RecordingInput> {
    const { rtpPort, rtcpPort } = this.ports.allocatePair()
    const transport = await router.createPlainTransport({
      ...plainTransportOptions,
      listenInfo: { ...plainTransportOptions.listenInfo, ip: '127.0.0.1', announcedAddress: undefined },
    })

    try {
      await transport.connect({ ip: '127.0.0.1', port: rtpPort, rtcpPort })

      // Консюмим с "очищенными" capabilities - без RTX-кодеков и без
      // rtcpFeedback (nack/transport-cc/goog-remb). Иначе mediasoup шлёт в тот
      // же порт ретрансмиссии и probation-пакеты со СВОИМИ sequence номерами,
      // и FFmpeg считает их "RTP: missed 20000+ packets", портя дорожку.
      const recordingRtpCapabilities = {
        ...router.rtpCapabilities,
        codecs: (router.rtpCapabilities.codecs ?? [])
          .filter((codec) => !codec.mimeType.toLowerCase().endsWith('/rtx'))
          .map((codec) => ({ ...codec, rtcpFeedback: [] })),
      }

      const consumer = await transport.consume({
        producerId: producer.id,
        rtpCapabilities: recordingRtpCapabilities,
        paused: false,
      })

      // Раньше здесь жёстко запрашивался ВЕРХНИЙ слой (spatialLayer 2). Это
      // вторая причина низкого fps: слой 2 - это 2500 кбит/с 720p, и когда
      // браузер врача упирается в CPU или аплинк (а он упирается - там же
      // идёт клиентская запись), верхний слой почти не производится. Консюмер,
      // прибитый к слою 2, получал в этом случае считанные кадры вместо
      // плавного отката на слой 1.
      //
      // Просим средний слой: 900 кбит/с 640x360 достаточно для окна 480x360 в
      // раскладке, этот слой производится стабильно, и mediasoup сам поднимет
      // качество, если полоса позволит.
      if (producer.kind === 'video') {
        try {
          await consumer.setPreferredLayers({ spatialLayer: 1, temporalLayer: 2 })
        } catch {
          // Не simulcast-продюсер - ничего фиксировать не нужно.
        }
      }

      const label = `${slot === 0 ? 'a' : 'b'}-${producer.kind}`
      const input: RecordingInput = {
        producerId: producer.id,
        kind: producer.kind,
        label,
        slot,
        transport,
        consumer,
        rtpPort,
        rtcpPort,
        sdpPath: path.join(recordingConfig.outputDir, `${session.id}.${label}.sdp`),
        // Аудио - сырой PCM без контейнера, видео - Matroska в live-режиме
        // (см. buildInputFfmpegArgs: оба формата переживают обрыв на SIGKILL).
        rawPath: path.join(
          recordingConfig.outputDir,
          `${session.id}.${label}.${producer.kind === 'audio' ? 'pcm' : 'mkv'}`,
        ),
        ffmpeg: null,
        startTs: null,
        startTsFallback: null,
      }

      trackMediaStart(input)
      this.watchProducerClose(session, input)
      this.watchProducerPauseResume(session, input)
      return input
    } catch (error) {
      this.ports.release(rtpPort)
      transport.close()
      throw error
    }
  }

  /**
   * ЭТО ПРИЧИНА "ЗАПИСАЛСЯ ТОЛЬКО ВРАЧ".
   *
   * Сегмент запускается на КОНКРЕТНЫХ объектах Producer, снятых в момент
   * старта. Когда участник переподключается (а пациент на мобильной сети
   * делает это регулярно), браузер закрывает старые продюсеры и публикует
   * НОВЫЕ. Консюмер записи висел на старом продюсере: mediasoup закрывает его
   * по 'producerclose', RTP в этот порт больше не приходит, FFmpeg дальше
   * пишет пустоту.
   *
   * Дальше срабатывал второй, куда более коварный эффект: новые продюсеры
   * вызывали onProducersChanged, но контроллер видел активную сессию и молча
   * выходил - подхватить свежие дорожки было НЕЧЕМ. В итоге пациент исчезал
   * из записи до конца сегмента: аудио пропадало целиком, а его половина
   * канваса оставалась последним кадром. Врач при этом писался нормально,
   * потому что он звонок не терял - отсюда и "записывается только врач".
   *
   * Лечим в согласии с архитектурой: одна консультация и так может состоять
   * из нескольких сегментов (файлов). Поэтому закрываем текущий сегмент и
   * открываем новый на свежих продюсерах, вместо попытки на ходу переподцепить
   * консюмер к тому же порту (FFmpeg привязывается к первому SSRC и второй
   * поток в тот же порт всё равно не принял бы).
   */
  private watchProducerClose(session: RecordingSession, input: RecordingInput): void {
    input.consumer.on('producerclose', () => {
      if (session.status !== 'recording' && session.status !== 'starting') return
      if (session.interrupted) return
      session.interrupted = true
      console.warn(
        `[Recorder] Producer for ${input.label} closed mid-segment (участник переподключился). ` +
          `Segment ${session.id} will be finalized and a new one started.`,
      )
      this.onSegmentInterrupted?.(session.roomId, input.label)
    })
  }

  /**
   * ЭТО ПРИЧИНА "КАМЕРА ВРАЧА ЧЁРНАЯ ТОЛЬКО В ЗАПИСИ".
   *
   * toggleCamera делает producer.pause() и дополнительно гасит продюсера на
   * SFU (pauseProducer), поэтому консюмер записи тоже встаёт - и это
   * правильно. Проблема в возврате: после resume кодировщик продолжает с
   * РАЗНОСТНОГО кадра, а опорного у FFmpeg больше нет. VP8 без опорного кадра
   * не декодируется - в файле чёрный экран.
   *
   * Живому собеседнику это незаметно, потому что его консюмер - обычный
   * WebRTC-консюмер: он сам присылает PLI и получает keyframe за десятки мс. У
   * записи такой возможности нет - мы намеренно вырезали rtcpFeedback в
   * createInput (иначе ретрансмиссии ломали дорожку). Отсюда и асимметрия:
   * "вживую видно, в записи чёрное".
   *
   * Раньше keyframe пришёл бы только со страховочного интервала, а он теперь
   * 30 с (его пришлось растянуть, чтобы убрать 2 fps) - то есть до полуминуты
   * черноты, а при неудачном совпадении с паузой и дольше. Поэтому на resume
   * запрашиваем keyframe сами, серией: первый запрос может прийти раньше, чем
   * кодировщик реально ожил.
   */
  private watchProducerPauseResume(session: RecordingSession, input: RecordingInput): void {
    // Аудио опорных кадров не имеет: Opus декодируется с любого пакета.
    if (input.kind !== 'video') return

    input.consumer.on('producerpause', () => {
      console.log(`[Recorder] ${input.label}: камера выключена, RTP остановлен`)
    })

    input.consumer.on('producerresume', () => {
      if (session.status !== 'recording' && session.status !== 'starting') return
      console.log(`[Recorder] ${input.label}: камера включена, запрашиваем keyframe`)

      for (const delayMs of [0, 300, 1000, 2500]) {
        const timer = setTimeout(() => {
          if (session.status !== 'recording' && session.status !== 'starting') return
          if (input.consumer.closed || input.consumer.paused) return
          input.consumer.requestKeyFrame().catch((error) => {
            console.warn(`[Recorder] ${input.label}: requestKeyFrame failed:`, error)
          })
        }, delayMs)
        timer.unref()
      }
    })
  }

  /**
   * Start recording one call segment with both participants.
   * recordingType is derived from the inputs: video when both have video.
   */
  async startSegment(
    roomId: string,
    router: Router,
    participantA: ParticipantProducers,
    participantB: ParticipantProducers,
    appointmentId: number | null,
  ): Promise<RecordingSession> {
    if (!this.checkFfmpegAvailable()) {
      throw new Error('FFmpeg is not available on the server')
    }

    const existing = this.getActiveRecordingForRoom(roomId)
    if (existing) return existing

    // Проверяем место ДО начала записи. Бросить здесь безопасно:
    // RecordingController ловит ошибку startSegment и просто логирует её, так
    // что звонок продолжится без записи. Это заметно лучше прежнего поведения,
    // когда место кончалось на середине разговора и терялась вся запись - молча.
    await assertEnoughFreeSpace()

    const withVideo = Boolean(participantA.video && participantB.video)
    const sessionId = `${roomId}-${Date.now()}`
    const session: RecordingSession = {
      id: sessionId,
      roomId,
      appointmentId,
      recordingType: withVideo ? 'video' : 'audio',
      startedAt: new Date(),
      status: 'starting',
      filePath: path.join(recordingConfig.outputDir, `${sessionId}.${recordingConfig.format}`),
      durationSeconds: 0,
      inputs: [],
      keyFrameTimer: null,
      interrupted: false,
    }
    this.sessions.set(sessionId, session)

    try {
      if (withVideo) {
        session.inputs.push(await this.createInput(session, router, participantA.video!, 0))
        session.inputs.push(await this.createInput(session, router, participantB.video!, 1))
      }
      session.inputs.push(await this.createInput(session, router, participantA.audio, 0))
      session.inputs.push(await this.createInput(session, router, participantB.audio, 1))

      // Каждому потоку - свой SDP и свой процесс FFmpeg.
      for (const input of session.inputs) {
        await writeFile(input.sdpPath, generateSdp(input))
        input.ffmpeg = startInputFfmpeg(session, input)
      }

      session.status = 'recording'

      // FFmpeg начинает писать видео только с ключевого кадра.
      if (withVideo) this.scheduleKeyFrameRequests(session)

      console.log(
        `[Recorder] Started ${session.recordingType} segment ${sessionId} for room ${roomId} ` +
          `(${session.inputs.length} independent FFmpeg processes)`,
      )
      return session
    } catch (error) {
      session.status = 'failed'
      session.error = error instanceof Error ? error.message : 'Unknown error'
      await stopInputProcesses(session)
      this.closeInputs(session)
      this.ports.releaseSession(session)
      console.error('[Recorder] Failed to start segment:', error)
      throw error
    }
  }

  private requestKeyFrames(session: RecordingSession): void {
    for (const input of session.inputs) {
      if (input.kind !== 'video') continue
      // Паузу пропускаем осознанно: пока камера выключена, запрос всё равно
      // никуда не уйдёт, а нужный keyframe закажет producerresume.
      if (input.consumer.closed || input.consumer.paused) continue
      input.consumer.requestKeyFrame().catch((error) => {
        // Раньше ошибка глушилась пустым catch: если keyframe перестал
        // приходить, картинка чернела без единой строки в логах.
        console.warn(`[Recorder] ${input.label}: requestKeyFrame failed:`, error)
      })
    }
  }

  /**
   * ЭТО БЫЛА ПРИЧИНА "2 FPS".
   *
   * Раньше здесь стоял setInterval(2000), который дёргал requestKeyFrame всю
   * запись. Выглядело логично (FFmpeg не умеет присылать PLI, значит поможем
   * ему сами), но эффект обратный, и вот почему.
   *
   * requestKeyFrame идёт ПРОДЮСЕРУ, то есть браузеру участника. Кодировщик у
   * продюсера ОДИН и общий для живого звонка и для записи. Ключевой кадр
   * весит в 5-15 раз больше разностного, а битрейт задан жёстко (см.
   * encodings в use-mediasoup). Прося keyframe каждые 2 с, мы заставляли
   * кодировщик тратить почти весь бюджет на опорные кадры - на разностные не
   * оставалось ничего, и он ронял частоту кадров до считанных единиц. То есть
   * 2 fps приходили УЖЕ ТАКИМИ от браузера, склейка тут ни при чём. Хуже
   * того, это одновременно портило картинку живому собеседнику.
   *
   * Правильно: запросить keyframe только на старте (чтобы FFmpeg начал писать
   * без долгого чёрного участка) и дальше не мешать - у VP8 есть свой
   * интервал опорных кадров, а потери на loopback-UDP практически исключены.
   * Оставляем редкую страховку раз в 30 с: на дистанции часа это ~120 лишних
   * кадров вместо ~1800 и не ломает бюджет кодировщика.
   */
  private scheduleKeyFrameRequests(session: RecordingSession): void {
    // Стартовые запросы: чем раньше придёт keyframe, тем короче чёрный
    // участок в начале видеодорожки.
    for (const delayMs of [200, 600, 1500, 3000]) {
      const timer = setTimeout(() => {
        if (session.status !== 'recording') return
        this.requestKeyFrames(session)
      }, delayMs)
      timer.unref()
    }

    const interval = setInterval(() => {
      if (session.status !== 'recording') {
        clearInterval(interval)
        return
      }
      this.requestKeyFrames(session)
    }, KEYFRAME_RECOVERY_INTERVAL_MS)
    interval.unref()
    session.keyFrameTimer = interval
  }

  private closeInputs(session: RecordingSession): void {
    for (const input of session.inputs) {
      if (!input.consumer.closed) input.consumer.close()
      if (!input.transport.closed) input.transport.close()
    }
  }

  /**
   * Сколько RTP mediasoup реально отправил в порт каждой дорожки.
   *
   * Это разделяет два неразличимых по файлам случая: аудиофайл нулевой потому,
   * что mediasoup ничего не послал (проблема на стороне продюсера/консюмера),
   * или потому, что FFmpeg принятое не записал (проблема в аргументах и SDP).
   * Снимаем ДО closeInputs - у закрытого консюмера статистики уже нет.
   */
  private async logConsumerStats(session: RecordingSession): Promise<void> {
    for (const input of session.inputs) {
      try {
        const stats = (await input.consumer.getStats()) as unknown as Array<{
          type?: string
          packetCount?: number
          byteCount?: number
        }>
        const rtp = stats.find((entry) => entry.type === 'outbound-rtp') ?? stats[0]
        console.log(
          `[Recorder] RTP -> ${input.label} (port ${input.rtpPort}): ` +
            `packets=${rtp?.packetCount ?? 'n/a'} bytes=${rtp?.byteCount ?? 'n/a'} ` +
            `paused=${input.consumer.paused} producerPaused=${input.consumer.producerPaused}`,
        )
      } catch (error) {
        console.warn(`[Recorder] Cannot read stats for ${input.label}:`, error)
      }
    }
  }

  private async cleanupTempFiles(session: RecordingSession): Promise<void> {
    await Promise.all(
      session.inputs.flatMap((input) => [
        unlink(input.rawPath).catch(() => {}),
        unlink(input.sdpPath).catch(() => {}),
      ]),
    )
  }

  async stopSegment(sessionId: string): Promise<RecordingSession> {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error(`Recording session ${sessionId} not found`)
    if (session.status === 'completed' || session.status === 'failed') return session

    session.status = 'stopping'
    session.durationSeconds = Math.max(1, Math.round((Date.now() - session.startedAt.getTime()) / 1000))

    if (session.keyFrameTimer) {
      clearInterval(session.keyFrameTimer)
      session.keyFrameTimer = null
    }

    // ВАЖЕН ПОРЯДОК: сначала останавливаем FFmpeg (пакеты ещё идут, поэтому
    // процесс не заблокирован в recvfrom и сразу читает "q"), и только потом
    // закрываем консюмеры mediasoup.
    await this.logConsumerStats(session)
    await stopInputProcesses(session)
    this.closeInputs(session)
    this.ports.releaseSession(session)

    const usable = session.inputs.filter((input) => hasUsableData(input))
    const skipped = session.inputs.filter((input) => !usable.includes(input))
    if (skipped.length > 0) {
      console.warn(`[Recorder] Skipping empty tracks: ${skipped.map((i) => i.label).join(', ')}`)
    }

    if (usable.length === 0) {
      session.status = 'failed'
      session.error = 'No usable tracks were recorded'
      await this.cleanupTempFiles(session)
      console.error(`[Recorder] Segment ${sessionId} has no usable tracks`)
      return session
    }

    // Если ни одно видео не записалось, отдаём аудиозапись - это честнее,
    // чем ронять весь сегмент.
    if (session.recordingType === 'video' && !usable.some((i) => i.kind === 'video')) {
      console.warn(`[Recorder] Segment ${sessionId} has no video tracks, saving as audio`)
      session.recordingType = 'audio'
    }

    // Видео без звука - это почти всегда сломанный приём аудио, а не норма.
    // Раньше такой сегмент уходил в файл молча, и "в записи нет звука"
    // обнаруживалось только при просмотре.
    if (!usable.some((i) => i.kind === 'audio')) {
      console.error(
        `[Recorder] Segment ${sessionId}: НЕТ НИ ОДНОЙ аудиодорожки - в файле не будет звука. ` +
          'Проверьте выше строки "Track *-audio: N bytes" и stderr FFmpeg по этим дорожкам.',
      )
    }

    try {
      session.status = 'composing'
      await composeSegment(session, usable)
      session.status = 'completed'
    } catch (error) {
      session.status = 'failed'
      session.error = error instanceof Error ? error.message : 'Compose failed'
      console.error(`[Recorder] Compose failed for ${sessionId}:`, error)
    }

    // Сырые дорожки удаляем ВСЕГДА, в том числе после провала склейки.
    //
    // Раньше при ошибке они оставались "для отладки", и это было плохим
    // обменом: часовая консультация - это ~1.3 ГБ сырых файлов, которые лежали
    // до перезагрузки. Несколько сбоев подряд забивали том, и тогда FFmpeg не
    // мог писать уже ВО ВРЕМЯ звонка - терялась не одна запись, а все
    // последующие. Диагностику дают логи (размеры дорожек, скорость склейки,
    // причина смерти процесса), а не гигабайты PCM.
    if (session.status === 'failed') {
      const free = await getFreeBytes()
      console.warn(
        `[Recorder] Session ${sessionId} failed, удаляем промежуточные файлы` +
          (free === null ? '' : ` (свободно ${Math.round(free / 1024 / 1024)} МБ)`),
      )
      // Итоговый webm при провале склейки недописан и бесполезен - забрать его
      // всё равно некому, а место занимает.
      await unlink(session.filePath).catch(() => {})
    }

    await this.cleanupTempFiles(session)

    console.log(`[Recorder] Stopped segment ${sessionId} (${session.durationSeconds}s, ${session.status})`)
    return session
  }

  async stopSegmentByRoom(roomId: string): Promise<RecordingSession | null> {
    const session = this.getActiveRecordingForRoom(roomId)
    if (!session) return null
    return this.stopSegment(session.id)
  }

  getSession(sessionId: string): RecordingSession | undefined {
    return this.sessions.get(sessionId)
  }

  getActiveRecordingForRoom(roomId: string): RecordingSession | undefined {
    return Array.from(this.sessions.values()).find(
      (s) => s.roomId === roomId && (s.status === 'recording' || s.status === 'starting'),
    )
  }

  cleanupOldSessions(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now()
    for (const [id, session] of this.sessions) {
      if (
        (session.status === 'completed' || session.status === 'failed') &&
        now - session.startedAt.getTime() > maxAgeMs
      ) {
        this.sessions.delete(id)
      }
    }
  }
}

export const recorder = new Recorder()
