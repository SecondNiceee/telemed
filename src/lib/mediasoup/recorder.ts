/**
 * MediaSoup Recorder
 *
 * Server-side recording using PlainTransport + FFmpeg.
 * Records BOTH participants of a call into a single WebM file:
 * - video call: two windows side by side (hstack) + mixed audio (amix)
 * - audio call: mixed audio only (amix)
 *
 * Each recording session corresponds to one "call segment": it starts when
 * both participants have published their tracks and stops when one of them
 * leaves. Multiple calls within one appointment produce multiple files.
 */

import { spawn, ChildProcess, execSync } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import { writeFile } from 'fs/promises'
import path from 'path'
import type { types as mediasoupTypes } from 'mediasoup'
import { recordingConfig, plainTransportOptions } from './config'

type Router = mediasoupTypes.Router
type Producer = mediasoupTypes.Producer
type PlainTransport = mediasoupTypes.PlainTransport
type Consumer = mediasoupTypes.Consumer

/** Media input of one participant that FFmpeg receives over RTP */
interface RecordingInput {
  producerId: string
  kind: 'audio' | 'video'
  transport: PlainTransport
  consumer: Consumer
  rtpPort: number
  rtcpPort: number
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
  status: 'starting' | 'recording' | 'stopping' | 'completed' | 'failed'
  filePath: string
  sdpPath: string
  durationSeconds: number
  ffmpegProcess: ChildProcess | null
  inputs: RecordingInput[]
  keyFrameTimer: NodeJS.Timeout | null
  error?: string
}

const PORT_RANGE_START = 5000
const PORT_RANGE_END = 5998

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
   * Pipe one producer to FFmpeg: PlainTransport consumes the producer and
   * sends RTP to 127.0.0.1:<rtpPort> where FFmpeg is listening (per SDP).
   * The transport binds its own port from the worker RTC range - it must NOT
   * bind the FFmpeg port, otherwise FFmpeg cannot listen on it.
   */
  private async createInput(router: Router, producer: Producer): Promise<RecordingInput> {
    const { rtpPort, rtcpPort } = this.allocatePortPair()
    const transport = await router.createPlainTransport({
      ...plainTransportOptions,
      listenInfo: { ...plainTransportOptions.listenInfo, ip: '127.0.0.1', announcedAddress: undefined },
    })

    try {
      await transport.connect({ ip: '127.0.0.1', port: rtpPort, rtcpPort })
      const consumer = await transport.consume({
        producerId: producer.id,
        rtpCapabilities: router.rtpCapabilities,
        paused: false,
      })

      // Фиксируем верхний simulcast-слой: иначе mediasoup переключает слои по
      // ходу звонка, разрешение меняется на лету и фильтр-граф FFmpeg встаёт.
      // mediasoup сам ограничит номер слоя, если их меньше.
      if (producer.kind === 'video') {
        try {
          await consumer.setPreferredLayers({ spatialLayer: 2, temporalLayer: 2 })
        } catch {
          // Не simulcast-продюсер - ничего фиксировать не нужно.
        }
      }

      return { producerId: producer.id, kind: producer.kind, transport, consumer, rtpPort, rtcpPort }
    } catch (error) {
      this.usedPorts.delete(rtpPort)
      transport.close()
      throw error
    }
  }

  /** SDP media section for one RTP input consumed from mediasoup. */
  private sdpMediaSection(input: RecordingInput): string[] {
    const codec = input.consumer.rtpParameters.codecs[0]
    const payloadType = codec.payloadType
    const codecName = codec.mimeType.split('/')[1]
    const lines: string[] = []

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
    return lines
  }

  private generateSdp(inputs: RecordingInput[]): string {
    const lines = ['v=0', 'o=- 0 0 IN IP4 127.0.0.1', 's=MediaSoup Recording', 'c=IN IP4 127.0.0.1', 't=0 0']
    for (const input of inputs) lines.push(...this.sdpMediaSection(input))
    return lines.join('\r\n') + '\r\n'
  }

  /**
   * FFmpeg args. The single SDP input exposes streams in m= section order.
   * Video segment: [v0][v1] hstack + [a0][a1] amix; audio segment: amix only.
   */
  private buildFfmpegArgs(session: RecordingSession): string[] {
    const hasVideo = session.recordingType === 'video'
    const args: string[] = [
      '-loglevel', 'warning',
      '-nostdin',
      '-protocol_whitelist', 'file,rtp,udp',
      '-fflags', '+genpts+discardcorrupt',
      '-analyzeduration', '10M',
      '-probesize', '10M',
      // Приёмный буфер: ядро всё равно ограничивает значение (net.core.rmem_max),
      // просим 8 МБ — реально выделяемый максимум, без предупреждений в логах.
      '-buffer_size', '8388608',
      // max_delay должен быть БОЛЬШИМ. При 0.5 с ffmpeg писал
      // "max delay reached / dropping old packet received too late" и выбрасывал
      // видеопакеты, из-за чего декодер терял опорный кадр.
      '-max_delay', '5000000',
      '-reorder_queue_size', '4096',
      '-thread_queue_size', '8192',
      '-i', session.sdpPath,
    ]

    if (hasVideo) {
      // Чёрный фон-канвас 1280x480, на который overlay кладёт двух участников.
      // БЕЗ -re: overlay (framesync) сам ждёт кадры живых RTP-потоков, а
      // realtime-чтение канваса с t=0 расходилось по времени с RTP-таймлинией.
      args.push('-f', 'lavfi', '-i', 'color=c=black:s=1280x480:r=15')
    }

    if (hasVideo) {
      args.push(
        '-filter_complex',
        // ВАЖНО: setpts=PTS-STARTPTS на каждом видеовходе. RTP-потоки приходят
        // с произвольными стартовыми таймстампами, а канвас начинается с нуля;
        // без нормализации overlay после пары секунд синхронизации показывает
        // только канвас - "чёрный экран". После выравнивания все три таймлинии
        // стартуют с нуля и склейка стабильна.
        // (hstack не используем: он не переживает смену simulcast-разрешения.)
        '[0:v:0]setpts=PTS-STARTPTS,fps=15,scale=640:480:force_original_aspect_ratio=decrease,' +
          'pad=640:480:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[left];' +
          '[0:v:1]setpts=PTS-STARTPTS,fps=15,scale=640:480:force_original_aspect_ratio=decrease,' +
          'pad=640:480:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[right];' +
          '[1:v]setpts=PTS-STARTPTS[canvas];' +
          '[canvas][left]overlay=x=0:y=0:shortest=0:repeatlast=1[base];' +
          '[base][right]overlay=x=640:y=0:shortest=0:repeatlast=1,format=yuv420p[v];' +
          '[0:a:0]asetpts=PTS-STARTPTS[a0];[0:a:1]asetpts=PTS-STARTPTS[a1];' +
          '[a0][a1]amix=inputs=2:duration=longest[a]',
        '-map', '[v]',
        '-map', '[a]',
        '-c:v', recordingConfig.videoCodec,
        '-deadline', 'realtime',
        '-cpu-used', '8',
        '-b:v', '1500k',
        '-g', '30',
        '-r', '15',
        // Канвас бесконечен, поэтому страхуемся жёстким лимитом: если стоп
        // сегмента почему-то не придёт, файл не будет расти бесконечно.
        '-t', '14400',
      )
    } else {
      args.push(
        '-filter_complex', '[0:a:0][0:a:1]amix=inputs=2:duration=longest[a]',
        '-map', '[a]',
      )
    }

    args.push('-c:a', recordingConfig.audioCodec, '-b:a', '128k', '-f', recordingConfig.format, '-y', session.filePath)
    return args
  }

  private startFfmpeg(session: RecordingSession): ChildProcess {
    const args = this.buildFfmpegArgs(session)
    console.log('[Recorder] Starting FFmpeg:', recordingConfig.ffmpegPath, args.join(' '))

    const ffmpeg = spawn(recordingConfig.ffmpegPath, args)

    ffmpeg.stderr?.on('data', (data: Buffer) => {
      const text = data.toString().trim()
      if (text) console.log(`[Recorder] FFmpeg [${session.id}]: ${text}`)
    })

    ffmpeg.on('close', (code) => {
      console.log(`[Recorder] FFmpeg [${session.id}] exited with code ${code}`)
      if (session.status === 'recording' || session.status === 'starting') {
        session.status = code === 0 ? 'completed' : 'failed'
        if (code !== 0) session.error = `FFmpeg exited with code ${code}`
      }
    })

    ffmpeg.on('error', (error) => {
      console.error(`[Recorder] FFmpeg [${session.id}] error:`, error)
      session.status = 'failed'
      session.error = error.message
    })

    return ffmpeg
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
      sdpPath: path.join(recordingConfig.outputDir, `${sessionId}.sdp`),
      durationSeconds: 0,
      ffmpegProcess: null,
      inputs: [],
      keyFrameTimer: null,
    }
    this.sessions.set(sessionId, session)

    try {
      // Input order defines SDP stream order: video A, video B, audio A, audio B.
      if (withVideo) {
        session.inputs.push(await this.createInput(router, participantA.video!))
        session.inputs.push(await this.createInput(router, participantB.video!))
      }
      session.inputs.push(await this.createInput(router, participantA.audio))
      session.inputs.push(await this.createInput(router, participantB.audio))

      await writeFile(session.sdpPath, this.generateSdp(session.inputs))
      session.ffmpegProcess = this.startFfmpeg(session)
      session.status = 'recording'

      // FFmpeg needs a keyframe to start decoding each video stream.
      if (withVideo) this.scheduleKeyFrameRequests(session)

      console.log(`[Recorder] Started ${session.recordingType} segment ${sessionId} for room ${roomId}`)
      return session
    } catch (error) {
      session.status = 'failed'
      session.error = error instanceof Error ? error.message : 'Unknown error'
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
   * Ключевые кадры нужно запрашивать ВСЮ запись, а не только на старте.
   * FFmpeg не умеет присылать PLI/FIR через RTCP, поэтому после любой потери
   * пакета декодер остаётся без опорного кадра и картинка "застывает"
   * навсегда. Регулярный requestKeyFrame восстанавливает видео за пару секунд.
   */
  private scheduleKeyFrameRequests(session: RecordingSession): void {
    // Стартовые запросы: покрывают время запуска FFmpeg.
    for (const delayMs of [500, 1500, 3000]) {
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
    }, 2000)
    interval.unref()
    session.keyFrameTimer = interval
  }

  private closeInputs(session: RecordingSession): void {
    for (const input of session.inputs) {
      if (!input.consumer.closed) input.consumer.close()
      if (!input.transport.closed) input.transport.close()
    }
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

    this.closeInputs(session)
    this.releasePorts(session)

    const ffmpeg = session.ffmpegProcess
    if (ffmpeg && ffmpeg.exitCode === null) {
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (ffmpeg.exitCode === null) {
            console.log(`[Recorder] FFmpeg [${session.id}] did not exit, killing`)
            ffmpeg.kill('SIGKILL')
          }
          resolve()
        }, 5000)
        ffmpeg.once('close', () => {
          clearTimeout(timeout)
          resolve()
        })
        // SIGTERM lets FFmpeg flush and close the WebM container properly.
        ffmpeg.kill('SIGTERM')
      })
    }

    if (session.status === 'stopping') session.status = 'completed'
    console.log(`[Recorder] Stopped segment ${sessionId} (${session.durationSeconds}s)`)
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
