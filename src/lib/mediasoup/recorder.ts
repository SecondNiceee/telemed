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
 */

import { spawn, ChildProcess, execSync } from 'child_process'
import { existsSync, mkdirSync, statSync } from 'fs'
import { writeFile, unlink } from 'fs/promises'
import path from 'path'
import type { types as mediasoupTypes } from 'mediasoup'
import { recordingConfig, plainTransportOptions } from './config'

type Router = mediasoupTypes.Router
type Producer = mediasoupTypes.Producer
type PlainTransport = mediasoupTypes.PlainTransport
type Consumer = mediasoupTypes.Consumer

/** Один медиапоток одного участника: свой порт, свой SDP, свой FFmpeg, свой файл */
interface RecordingInput {
  producerId: string
  kind: 'audio' | 'video'
  /** Читаемая метка для логов и раскладки: a-video, b-video, a-audio, b-audio */
  label: string
  /** Порядок участника: 0 - левое окно, 1 - правое окно */
  slot: 0 | 1
  transport: PlainTransport
  consumer: Consumer
  rtpPort: number
  rtcpPort: number
  sdpPath: string
  rawPath: string
  ffmpeg: ChildProcess | null
  /**
   * Момент начала медиа этой дорожки по часам mediasoup-воркера (мс).
   * Все дорожки замеряются одним и тем же клоком, поэтому разности
   * корректны - именно они превращаются в -itsoffset на этапе склейки.
   */
  startTs: number | null
  /** Резервный замер по часам Node, если trace не дал timestamp */
  startTsFallback: number | null
}

/** Producers of one participant to include in a segment */
export interface ParticipantProducers {
  peerId: string
  audio: Producer
  video?: Producer
}

export interface RecordingSession {
  id: string
  roomId: string
  appointmentId: number | null
  recordingType: 'video' | 'audio'
  startedAt: Date
  status: 'starting' | 'recording' | 'stopping' | 'composing' | 'completed' | 'failed'
  filePath: string
  durationSeconds: number
  inputs: RecordingInput[]
  keyFrameTimer: NodeJS.Timeout | null
  error?: string
}

const PORT_RANGE_START = 5000
const PORT_RANGE_END = 5998

/** Файл меньше этого размера считаем пустым (FFmpeg не получил медиа) */
const MIN_USABLE_FILE_BYTES = 2048

/**
 * Редкая страховка на случай, если FFmpeg всё же потерял опорный кадр.
 * Раньше здесь было 2000 мс - именно это и роняло частоту кадров до ~2 fps
 * (подробности в scheduleKeyFrameRequests).
 */
const KEYFRAME_RECOVERY_INTERVAL_MS = 30_000

/** Частота кадров итоговой записи: одна и та же для фильтров и для вывода. */
const OUTPUT_FPS = 15

/**
 * Раскладка 2x1. Панели 16:9 под вебкамеру: раньше стояло 640x480 (4:3), и
 * кадр 16:9 вписывался туда с чёрными полосами сверху и снизу - четверть
 * площади уходила впустую и всё равно кодировалась.
 */
const PANE_W = 640
const PANE_H = 360
const CANVAS_W = PANE_W * 2
const CANVAS_H = PANE_H

class Recorder {
  private readonly sessions = new Map<string, RecordingSession>()
  private readonly usedPorts = new Set<number>()
  private ffmpegAvailable: boolean | null = null

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

  /** Allocate an even RTP port + odd RTCP port pair, tracking usage. */
  private allocatePortPair(): { rtpPort: number; rtcpPort: number } {
    for (let port = PORT_RANGE_START; port <= PORT_RANGE_END; port += 2) {
      if (!this.usedPorts.has(port)) {
        this.usedPorts.add(port)
        return { rtpPort: port, rtcpPort: port + 1 }
      }
    }
    throw new Error('No free RTP ports for recording')
  }

  private releasePorts(session: RecordingSession): void {
    for (const input of session.inputs) this.usedPorts.delete(input.rtpPort)
  }

  /**
   * Замер момента старта дорожки через mediasoup trace.
   *
   * Для аудио опорная точка - первый RTP-пакет. Для видео - первый КЛЮЧЕВОЙ
   * КАДР: FFmpeg отбрасывает видеопакеты до него, поэтому файл фактически
   * начинается с keyframe, и именно его надо брать за ноль дорожки.
   * После замера trace отключаем, чтобы не грузить воркер.
   */
  private trackMediaStart(input: RecordingInput): void {
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
   * Pipe one producer to FFmpeg: PlainTransport consumes the producer and
   * sends RTP to 127.0.0.1:<rtpPort> where FFmpeg is listening (per SDP).
   */
  private async createInput(
    session: RecordingSession,
    router: Router,
    producer: Producer,
    slot: 0 | 1,
  ): Promise<RecordingInput> {
    const { rtpPort, rtcpPort } = this.allocatePortPair()
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
        rawPath: path.join(recordingConfig.outputDir, `${session.id}.${label}.mkv`),
        ffmpeg: null,
        startTs: null,
        startTsFallback: null,
      }

      this.trackMediaStart(input)
      return input
    } catch (error) {
      this.usedPorts.delete(rtpPort)
      transport.close()
      throw error
    }
  }

  /**
   * SDP ровно с ОДНОЙ m=-секцией. Это ключ к новой схеме: у процесса FFmpeg
   * нет второго потока, с которым надо что-то синхронизировать.
   */
  private generateSdp(input: RecordingInput): string {
    const codec = input.consumer.rtpParameters.codecs[0]
    const payloadType = codec.payloadType
    const codecName = codec.mimeType.split('/')[1]

    const lines = ['v=0', 'o=- 0 0 IN IP4 127.0.0.1', 's=MediaSoup Recording', 'c=IN IP4 127.0.0.1', 't=0 0']

    if (input.kind === 'video') {
      lines.push(`m=video ${input.rtpPort} RTP/AVP ${payloadType}`)
      lines.push(`a=rtpmap:${payloadType} ${codecName}/${codec.clockRate}`)
    } else {
      lines.push(`m=audio ${input.rtpPort} RTP/AVP ${payloadType}`)
      lines.push(`a=rtpmap:${payloadType} ${codecName}/${codec.clockRate}/${codec.channels || 2}`)
    }

    const fmtp = Object.entries(codec.parameters ?? {})
      .map(([key, value]) => `${key}=${value}`)
      .join(';')
    if (fmtp) lines.push(`a=fmtp:${payloadType} ${fmtp}`)
    lines.push(`a=rtcp:${input.rtcpPort}`)
    lines.push('a=recvonly')

    return lines.join('\r\n') + '\r\n'
  }

  /**
   * ЭТАП 1: приём одного потока и запись в файл без перекодирования.
   *
   * -use_wallclock_as_timestamps ставит метки по времени прихода пакетов. Для
   * ОДНОГО потока это идеально: метки монотонны, длительность файла равна
   * реальному времени, и никакие RTP-таймстампы уже ничего не портят.
   * Без -nostdin: остановка идёт командой "q" через stdin - только так FFmpeg
   * гарантированно финализирует контейнер.
   */
  private buildInputFfmpegArgs(input: RecordingInput): string[] {
    const args = [
      '-loglevel', 'warning',
      '-protocol_whitelist', 'file,rtp,udp',
      '-analyzeduration', '5M',
      '-probesize', '5M',
      '-buffer_size', '8388608',
      '-max_delay', '1000000',
      '-reorder_queue_size', '2048',
      '-thread_queue_size', '8192',
    ]

    // ЭТО БЫЛА ПРИЧИНА РАССИНХРОНА ЗВУКА.
    //
    // Раньше -use_wallclock_as_timestamps ставился ВСЕМ дорожкам, включая
    // аудио. Для видео это разумно: VP8-кадры приходят неравномерно, и время
    // прихода - лучшая оценка их места на таймлинии. Для аудио - наоборот
    // губительно.
    //
    // Opus идёт пакетами по 20 мс, и RTP-таймстамп у него - точный СЧЁТЧИК
    // СЭМПЛОВ на 48 кГц. Подменяя его временем прихода пакета, мы вносили в
    // аудио-таймлинию сетевой джиттер: длительность дорожки перестаёт
    // соответствовать числу сэмплов. На коротком отрезке это незаметно, а на
    // часовой консультации ошибка копится в секунды - ровно тот уплывающий
    // звук, который и наблюдался. Поэтому для аудио оставляем родные
    // RTP-таймстампы: они сэмпл-точные и не плывут.
    if (input.kind === 'video') {
      args.push('-use_wallclock_as_timestamps', '1')
    }

    args.push(
      '-i', input.sdpPath,
      '-map', '0',
      '-c', 'copy',
      '-f', 'matroska',
      '-y', input.rawPath,
    )
    return args
  }

  private startInputFfmpeg(session: RecordingSession, input: RecordingInput): ChildProcess {
    const args = this.buildInputFfmpegArgs(input)
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

  /** Дорожка пригодна для склейки, только если FFmpeg реально что-то записал */
  private hasUsableData(input: RecordingInput): boolean {
    try {
      return existsSync(input.rawPath) && statSync(input.rawPath).size >= MIN_USABLE_FILE_BYTES
    } catch {
      return false
    }
  }

  /**
   * Смещения дорожек в секундах относительно самой ранней из них.
   * Используем trace-часы mediasoup, если они есть у ВСЕХ дорожек (иначе
   * единицы измерения смешались бы), иначе часы Node, иначе нули.
   */
  private computeOffsets(inputs: RecordingInput[]): Map<RecordingInput, number> {
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

  /**
   * ЭТАП 2: офлайн-склейка отдельных файлов в итоговый WebM.
   *
   * Каждый файл подключается со своим -itsoffset, поэтому дорожки встают на
   * общую таймлинию ровно так, как они шли в реальности. Чёрный канвас задаёт
   * геометрию кадра и живёт всю запись, поэтому пауза или обрыв одного видео
   * не роняет картинку целиком. Здесь нет реального времени: FFmpeg считает
   * столько, сколько нужно, и кадры не теряются.
   */
  private buildComposeArgs(session: RecordingSession, usable: RecordingInput[]): string[] {
    const videos = usable.filter((i) => i.kind === 'video').sort((a, b) => a.slot - b.slot)
    const audios = usable.filter((i) => i.kind === 'audio').sort((a, b) => a.slot - b.slot)
    const withVideo = videos.length > 0
    const offsets = this.computeOffsets(usable)

    const args: string[] = ['-loglevel', 'warning', '-nostdin']
    const streamIndex = new Map<RecordingInput, number>()
    let nextIndex = 0

    if (withVideo) {
      args.push('-f', 'lavfi', '-i', `color=c=black:s=${CANVAS_W}x${CANVAS_H}:r=${OUTPUT_FPS}`)
      nextIndex = 1
    }

    for (const input of [...videos, ...audios]) {
      const offset = offsets.get(input) ?? 0
      if (offset > 0) args.push('-itsoffset', String(offset))
      args.push('-i', input.rawPath)
      streamIndex.set(input, nextIndex)
      nextIndex += 1
    }

    const filters: string[] = []
    const windowChain = (index: number, name: string) =>
      `[${index}:v]fps=${OUTPUT_FPS},scale=${PANE_W}:${PANE_H}:force_original_aspect_ratio=decrease,` +
      `pad=${PANE_W}:${PANE_H}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[${name}]`

    if (withVideo) {
      // Каждое видео кладём на канвас. eof_action=pass + repeatlast=0: когда
      // поток участника заканчивается, его половина просто становится чёрной,
      // а запись продолжается (раньше конец одного потока обрезал всё видео).
      let base = '[0:v]'
      videos.forEach((input, position) => {
        const name = position === 0 ? 'w0' : 'w1'
        filters.push(windowChain(streamIndex.get(input) as number, name))
        const x = input.slot === 0 ? 0 : PANE_W
        const isLast = position === videos.length - 1
        const out = isLast ? '[v]' : `[b${position}]`
        const tail = isLast ? ',format=yuv420p' : ''
        filters.push(`${base}[${name}]overlay=x=${x}:y=0:eof_action=pass:repeatlast=0${tail}${out}`)
        base = out
      })
    }

    // async=1000 разрешал ресемплеру растягивать/сжимать до 1000 сэмплов в
    // секунду, подгоняя звук под джиттерные PTS - на длинной записи это давало
    // накопительный уплыв и слышимую порчу тембра. Теперь PTS у аудио честные
    // (см. buildInputFfmpegArgs), поэтому агрессивная подгонка не нужна:
    // async=1 только вставляет тишину в реальные разрывы, min_hard_comp
    // задаёт порог 100 мс, а first_pts=0 прибивает начало дорожки к нулю,
    // чтобы -itsoffset остался единственным источником смещения.
    const RESAMPLE = 'aresample=async=1:min_hard_comp=0.100:first_pts=0'

    if (audios.length === 2) {
      const [first, second] = audios
      filters.push(`[${streamIndex.get(first)}:a]${RESAMPLE}[a0]`)
      filters.push(`[${streamIndex.get(second)}:a]${RESAMPLE}[a1]`)
      filters.push(`[a0][a1]amix=inputs=2:duration=longest:normalize=0${withVideo ? ',apad' : ''}[a]`)
    } else if (audios.length === 1) {
      filters.push(`[${streamIndex.get(audios[0])}:a]${RESAMPLE}${withVideo ? ',apad' : ''}[a]`)
    }

    args.push('-filter_complex', filters.join(';'))

    if (withVideo) args.push('-map', '[v]')
    if (audios.length > 0) args.push('-map', '[a]')

    if (withVideo) {
      args.push(
        // Канвас бесконечен, а apad добавляет тишину - длительность задаём сами
        // по реальному времени сегмента.
        '-t', String(session.durationSeconds),
        '-c:v', recordingConfig.videoCodec,
        '-deadline', 'good',
        '-cpu-used', '4',
        '-b:v', '1500k',
        '-g', '60',
        // Постоянная частота кадров на выводе: входные дорожки принципиально
        // VFR (wallclock-метки), и рваные PTS дали бы "плавающий" fps.
        // Осознанно только -r, без -fps_mode cfr: -fps_mode появился в FFmpeg
        // 5.0, а на Ubuntu 20.04 штатный ffmpeg - 4.2, где эта опция валит
        // процесс целиком. CFR и без неё гарантирован: фильтр fps= на каждом
        // окне, чёрный канвас с r=OUTPUT_FPS как база overlay и это -r.
        '-r', String(OUTPUT_FPS),
      )
    }

    args.push(
      '-avoid_negative_ts', 'make_zero',
      '-c:a', recordingConfig.audioCodec,
      '-b:a', '128k',
      '-f', recordingConfig.format,
      '-y', session.filePath,
    )
    return args
  }

  /** Запускает офлайн-склейку и ждёт её завершения. */
  private composeSegment(session: RecordingSession, usable: RecordingInput[]): Promise<void> {
    const args = this.buildComposeArgs(session, usable)
    console.log('[Recorder] Composing:', recordingConfig.ffmpegPath, args.join(' '))

    return new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn(recordingConfig.ffmpegPath, args)

      ffmpeg.stderr?.on('data', (data: Buffer) => {
        const text = data.toString().trim()
        if (text) console.log(`[Recorder] Compose [${session.id}]: ${text}`)
      })

      // Страховка: склейка не должна длиться дольше 30 минут.
      const timeout = setTimeout(() => {
        if (ffmpeg.exitCode === null) ffmpeg.kill('SIGKILL')
      }, 30 * 60 * 1000)
      timeout.unref()

      ffmpeg.on('error', (error) => {
        clearTimeout(timeout)
        reject(error)
      })
      ffmpeg.on('close', (code) => {
        clearTimeout(timeout)
        if (code === 0) resolve()
        else reject(new Error(`Compose FFmpeg exited with code ${code}`))
      })
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

    if (!existsSync(recordingConfig.outputDir)) {
      mkdirSync(recordingConfig.outputDir, { recursive: true })
    }

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
        await writeFile(input.sdpPath, this.generateSdp(input))
        input.ffmpeg = this.startInputFfmpeg(session, input)
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
      await this.stopInputProcesses(session)
      this.closeInputs(session)
      this.releasePorts(session)
      console.error('[Recorder] Failed to start segment:', error)
      throw error
    }
  }

  private requestKeyFrames(session: RecordingSession): void {
    for (const input of session.inputs) {
      if (input.kind === 'video' && !input.consumer.closed) {
        input.consumer.requestKeyFrame().catch(() => {})
      }
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
   * Останавливает процесс FFmpeg одной дорожки эскалацией "q" -> SIGTERM ->
   * SIGKILL. Команда "q" через stdin - единственный способ, при котором
   * FFmpeg дописывает контейнер (иначе файл остаётся битым).
   */
  private stopInputProcess(session: RecordingSession, input: RecordingInput): Promise<void> {
    const ffmpeg = input.ffmpeg
    if (!ffmpeg || ffmpeg.exitCode !== null) return Promise.resolve()

    return new Promise<void>((resolve) => {
      const termTimer = setTimeout(() => {
        if (ffmpeg.exitCode === null) {
          console.log(`[Recorder] FFmpeg [${session.id}/${input.label}] ignored "q", sending SIGTERM`)
          ffmpeg.kill('SIGTERM')
        }
      }, 4000)
      termTimer.unref()

      const killTimer = setTimeout(() => {
        if (ffmpeg.exitCode === null) {
          console.log(`[Recorder] FFmpeg [${session.id}/${input.label}] did not exit, killing`)
          ffmpeg.kill('SIGKILL')
        }
        resolve()
      }, 8000)
      killTimer.unref()

      ffmpeg.once('close', () => {
        clearTimeout(termTimer)
        clearTimeout(killTimer)
        resolve()
      })

      try {
        if (ffmpeg.stdin && ffmpeg.stdin.writable) {
          ffmpeg.stdin.write('q')
          ffmpeg.stdin.end()
        } else {
          ffmpeg.kill('SIGTERM')
        }
      } catch {
        ffmpeg.kill('SIGTERM')
      }
    })
  }

  /** Все дорожки останавливаем параллельно, пока RTP ещё идёт. */
  private async stopInputProcesses(session: RecordingSession): Promise<void> {
    await Promise.all(session.inputs.map((input) => this.stopInputProcess(session, input)))
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
    await this.stopInputProcesses(session)
    this.closeInputs(session)
    this.releasePorts(session)

    const usable = session.inputs.filter((input) => this.hasUsableData(input))
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

    try {
      session.status = 'composing'
      await this.composeSegment(session, usable)
      session.status = 'completed'
    } catch (error) {
      session.status = 'failed'
      session.error = error instanceof Error ? error.message : 'Compose failed'
      console.error(`[Recorder] Compose failed for ${sessionId}:`, error)
    }

    // При ошибке оставляем сырые дорожки для отладки.
    if (session.status === 'completed') await this.cleanupTempFiles(session)

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
