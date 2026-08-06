/**
 * MediaSoup Recorder
 * 
 * Server-side recording using PlainTransport + FFmpeg.
 * Records both video and audio streams from a room into a single WebM file.
 */

import { spawn, ChildProcess, execSync } from 'child_process'
import { createWriteStream, existsSync, mkdirSync } from 'fs'
import path from 'path'
import type { types as mediasoupTypes } from 'mediasoup'

type Router = mediasoupTypes.Router
type Producer = mediasoupTypes.Producer
type PlainTransport = mediasoupTypes.PlainTransport
type Consumer = mediasoupTypes.Consumer
type RtpParameters = mediasoupTypes.RtpParameters
import { recordingConfig, plainTransportOptions } from './config'

/**
 * Recording session for a single producer (audio or video)
 */
interface ProducerRecording {
  producerId: string
  kind: 'audio' | 'video'
  transport: PlainTransport
  consumer: Consumer
  rtpPort: number
  rtcpPort: number
}

/**
 * Active recording session
 */
export interface RecordingSession {
  id: string
  roomId: string
  appointmentId: number | null // Store appointment ID for server-side finalization
  recordingType: 'video' | 'audio' // Type of recording
  startedAt: Date
  status: 'starting' | 'recording' | 'stopping' | 'completed' | 'failed'
  filePath: string
  ffmpegProcess: ChildProcess | null
  producerRecordings: Map<string, ProducerRecording>
  // Port assignments
  videoRtpPort?: number
  videoRtcpPort?: number
  audioRtpPort?: number
  audioRtcpPort?: number
  error?: string
}

class Recorder {
  private sessions: Map<string, RecordingSession> = new Map()
  private nextRtpPort = 5000 // Starting port for RTP
  private ffmpegAvailable: boolean | null = null

  /**
   * Check if FFmpeg is available
   */
  checkFfmpegAvailable(): boolean {
    if (this.ffmpegAvailable !== null) {
      return this.ffmpegAvailable
    }

    try {
      execSync(`${recordingConfig.ffmpegPath} -version`, { stdio: 'ignore' })
      this.ffmpegAvailable = true
      console.log('[Recorder] FFmpeg is available')
    } catch {
      this.ffmpegAvailable = false
      console.warn('[Recorder] FFmpeg is NOT available - recording will fail')
    }

    return this.ffmpegAvailable
  }

  /**
   * Get the next available RTP port pair
   */
  private getNextPortPair(): { rtpPort: number; rtcpPort: number } {
    const rtpPort = this.nextRtpPort
    const rtcpPort = rtpPort + 1
    this.nextRtpPort += 2
    
    // Wrap around if we exceed a reasonable range
    if (this.nextRtpPort > 6000) {
      this.nextRtpPort = 5000
    }
    
    return { rtpPort, rtcpPort }
  }

  /**
   * Create a PlainTransport for receiving RTP from a producer
   */
  private async createPlainTransport(
    router: Router,
    rtpPort: number,
    rtcpPort: number
  ): Promise<PlainTransport> {
    const transport = await router.createPlainTransport({
      ...plainTransportOptions,
      listenInfo: {
        ...plainTransportOptions.listenInfo,
        port: rtpPort,
      },
      rtcpListenInfo: {
        ...plainTransportOptions.listenInfo,
        port: rtcpPort,
      },
    })

    return transport
  }

  /**
   * Create a consumer on the plain transport to receive the producer's media
   */
  private async createPlainConsumer(
    transport: PlainTransport,
    router: Router,
    producer: Producer
  ): Promise<Consumer> {
    const consumer = await transport.consume({
      producerId: producer.id,
      rtpCapabilities: router.rtpCapabilities,
      paused: false,
    })

    return consumer
  }

  /**
   * Get SDP file content for FFmpeg input
   */
  private generateSdp(
    videoPort: number | undefined,
    audioPort: number | undefined,
    videoRtpParameters: RtpParameters | undefined,
    audioRtpParameters: RtpParameters | undefined
  ): string {
    const lines: string[] = [
      'v=0',
      'o=- 0 0 IN IP4 127.0.0.1',
      's=MediaSoup Recording',
      'c=IN IP4 127.0.0.1',
      't=0 0',
    ]

    // Video media line
    if (videoPort && videoRtpParameters) {
      const videoCodec = videoRtpParameters.codecs[0]
      const payloadType = videoCodec.payloadType

      lines.push(`m=video ${videoPort} RTP/AVP ${payloadType}`)
      lines.push(`a=rtpmap:${payloadType} ${videoCodec.mimeType.split('/')[1]}/${videoCodec.clockRate}`)
      
      if (videoCodec.parameters) {
        const fmtp = Object.entries(videoCodec.parameters)
          .map(([k, v]) => `${k}=${v}`)
          .join(';')
        if (fmtp) {
          lines.push(`a=fmtp:${payloadType} ${fmtp}`)
        }
      }
      
      lines.push('a=recvonly')
    }

    // Audio media line
    if (audioPort && audioRtpParameters) {
      const audioCodec = audioRtpParameters.codecs[0]
      const payloadType = audioCodec.payloadType

      lines.push(`m=audio ${audioPort} RTP/AVP ${payloadType}`)
      lines.push(`a=rtpmap:${payloadType} ${audioCodec.mimeType.split('/')[1]}/${audioCodec.clockRate}/${audioCodec.channels || 2}`)
      lines.push('a=recvonly')
    }

    return lines.join('\r\n') + '\r\n'
  }

  /**
   * Start FFmpeg recording process
   */
  private startFfmpeg(session: RecordingSession, sdpPath: string): ChildProcess {
    const args: string[] = [
      '-loglevel', 'warning',
      '-protocol_whitelist', 'file,rtp,udp',
      '-fflags', '+genpts',
      '-i', sdpPath,
    ]

    // Output settings
    if (session.videoRtpPort) {
      args.push('-c:v', recordingConfig.videoCodec)
      args.push('-b:v', '1M')
    }
    
    if (session.audioRtpPort) {
      args.push('-c:a', recordingConfig.audioCodec)
      args.push('-b:a', '128k')
    }

    args.push(
      '-f', recordingConfig.format,
      '-y', // Overwrite output
      session.filePath
    )

    console.log(`[Recorder] Starting FFmpeg:`, recordingConfig.ffmpegPath, args.join(' '))

    const ffmpeg = spawn(recordingConfig.ffmpegPath, args)

    ffmpeg.stdout?.on('data', (data) => {
      console.log(`[Recorder] FFmpeg stdout: ${data}`)
    })

    ffmpeg.stderr?.on('data', (data) => {
      console.log(`[Recorder] FFmpeg stderr: ${data}`)
    })

    ffmpeg.on('close', (code) => {
      console.log(`[Recorder] FFmpeg process exited with code ${code}`)
      if (session.status === 'recording') {
        session.status = code === 0 ? 'completed' : 'failed'
        if (code !== 0) {
          session.error = `FFmpeg exited with code ${code}`
        }
      }
    })

    ffmpeg.on('error', (error) => {
      console.error(`[Recorder] FFmpeg error:`, error)
      session.status = 'failed'
      session.error = error.message
    })

    return ffmpeg
  }

  /**
   * Start recording a room
   * @param roomId - The room ID (format: "appointment_123")
   * @param router - MediaSoup router
   * @param producers - Map of producers to record
   * @param appointmentId - Optional appointment ID for server-side finalization
   * @param recordingType - Type of recording ('video' or 'audio')
   */
  async startRecording(
    roomId: string,
    router: Router,
    producers: Map<string, Producer>,
    appointmentId?: number,
    recordingType: 'video' | 'audio' = 'video'
  ): Promise<RecordingSession> {
    // Check if FFmpeg is available
    if (!this.checkFfmpegAvailable()) {
      throw new Error('FFmpeg is not available on the server. Please install FFmpeg to enable recording.')
    }

    // Check if recording already exists for this room
    const existingSession = Array.from(this.sessions.values()).find(
      (s) => s.roomId === roomId && (s.status === 'recording' || s.status === 'starting')
    )
    if (existingSession) {
      console.log(`[Recorder] Recording already exists for room ${roomId}`)
      return existingSession
    }

    // Create output directory if it doesn't exist
    if (!existsSync(recordingConfig.outputDir)) {
      mkdirSync(recordingConfig.outputDir, { recursive: true })
    }

    // Generate session ID and file path
    const sessionId = `${roomId}-${Date.now()}`
    const filePath = path.join(recordingConfig.outputDir, `${sessionId}.${recordingConfig.format}`)

    const session: RecordingSession = {
      id: sessionId,
      roomId,
      appointmentId: appointmentId ?? null,
      recordingType,
      startedAt: new Date(),
      status: 'starting',
      filePath,
      ffmpegProcess: null,
      producerRecordings: new Map(),
    }

    this.sessions.set(sessionId, session)

    try {
      // Find video and audio producers
      let videoProducer: Producer | undefined
      let audioProducer: Producer | undefined
      let videoRtpParameters: RtpParameters | undefined
      let audioRtpParameters: RtpParameters | undefined

      for (const producer of producers.values()) {
        if (producer.kind === 'video' && !videoProducer) {
          videoProducer = producer
        } else if (producer.kind === 'audio' && !audioProducer) {
          audioProducer = producer
        }
      }

      if (!videoProducer && !audioProducer) {
        throw new Error('No producers to record')
      }

      // Create plain transports and consumers for video
      if (videoProducer) {
        const { rtpPort, rtcpPort } = this.getNextPortPair()
        session.videoRtpPort = rtpPort
        session.videoRtcpPort = rtcpPort

        const transport = await this.createPlainTransport(router, rtpPort, rtcpPort)
        const consumer = await this.createPlainConsumer(transport, router, videoProducer)

        // Connect the transport to localhost
        await transport.connect({
          ip: '127.0.0.1',
          port: rtpPort,
          rtcpPort: rtcpPort,
        })

        videoRtpParameters = consumer.rtpParameters

        session.producerRecordings.set(videoProducer.id, {
          producerId: videoProducer.id,
          kind: 'video',
          transport,
          consumer,
          rtpPort,
          rtcpPort,
        })

        console.log(`[Recorder] Created video recording on port ${rtpPort}`)
      }

      // Create plain transports and consumers for audio
      if (audioProducer) {
        const { rtpPort, rtcpPort } = this.getNextPortPair()
        session.audioRtpPort = rtpPort
        session.audioRtcpPort = rtcpPort

        const transport = await this.createPlainTransport(router, rtpPort, rtcpPort)
        const consumer = await this.createPlainConsumer(transport, router, audioProducer)

        // Connect the transport to localhost
        await transport.connect({
          ip: '127.0.0.1',
          port: rtpPort,
          rtcpPort: rtcpPort,
        })

        audioRtpParameters = consumer.rtpParameters

        session.producerRecordings.set(audioProducer.id, {
          producerId: audioProducer.id,
          kind: 'audio',
          transport,
          consumer,
          rtpPort,
          rtcpPort,
        })

        console.log(`[Recorder] Created audio recording on port ${rtpPort}`)
      }

      // Generate SDP file for FFmpeg
      const sdpContent = this.generateSdp(
        session.videoRtpPort,
        session.audioRtpPort,
        videoRtpParameters,
        audioRtpParameters
      )

      const sdpPath = path.join(recordingConfig.outputDir, `${sessionId}.sdp`)
      const sdpStream = createWriteStream(sdpPath)
      sdpStream.write(sdpContent)
      sdpStream.end()

      console.log(`[Recorder] Generated SDP file: ${sdpPath}`)
      console.log(`[Recorder] SDP content:\n${sdpContent}`)

      // Start FFmpeg
      session.ffmpegProcess = this.startFfmpeg(session, sdpPath)
      session.status = 'recording'

      console.log(`[Recorder] Started recording session ${sessionId} for room ${roomId}`)

      return session
    } catch (error) {
      session.status = 'failed'
      session.error = error instanceof Error ? error.message : 'Unknown error'
      console.error(`[Recorder] Failed to start recording:`, error)
      throw error
    }
  }

  /**
   * Add a producer to an existing recording session
   */
  async addProducerToRecording(
    sessionId: string,
    router: Router,
    producer: Producer
  ): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Recording session ${sessionId} not found`)
    }

    if (session.status !== 'recording') {
      throw new Error(`Recording session ${sessionId} is not active`)
    }

    // Check if already recording this producer
    if (session.producerRecordings.has(producer.id)) {
      console.log(`[Recorder] Already recording producer ${producer.id}`)
      return
    }

    const { rtpPort, rtcpPort } = this.getNextPortPair()
    const transport = await this.createPlainTransport(router, rtpPort, rtcpPort)
    const consumer = await this.createPlainConsumer(transport, router, producer)

    await transport.connect({
      ip: '127.0.0.1',
      port: rtpPort,
      rtcpPort: rtcpPort,
    })

    session.producerRecordings.set(producer.id, {
      producerId: producer.id,
      kind: producer.kind,
      transport,
      consumer,
      rtpPort,
      rtcpPort,
    })

    console.log(`[Recorder] Added ${producer.kind} producer ${producer.id} to session ${sessionId}`)
  }

  /**
   * Stop a recording session
   */
  async stopRecording(sessionId: string): Promise<RecordingSession> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Recording session ${sessionId} not found`)
    }

    if (session.status === 'completed' || session.status === 'failed') {
      return session
    }

    session.status = 'stopping'

    // Close all plain transports (this stops the consumers)
    for (const recording of session.producerRecordings.values()) {
      recording.consumer.close()
      recording.transport.close()
    }

    // Stop FFmpeg gracefully
    if (session.ffmpegProcess) {
      await new Promise<void>((resolve) => {
        const ffmpeg = session.ffmpegProcess!
        
        ffmpeg.once('close', () => {
          resolve()
        })

        // Send 'q' to FFmpeg stdin to quit gracefully
        if (ffmpeg.stdin) {
          ffmpeg.stdin.write('q')
          ffmpeg.stdin.end()
        }

        // Fallback: kill after 5 seconds
        setTimeout(() => {
          if (ffmpeg.exitCode === null) {
            console.log('[Recorder] FFmpeg did not exit gracefully, killing...')
            ffmpeg.kill('SIGKILL')
          }
          resolve()
        }, 5000)
      })
    }

    session.status = 'completed'
    console.log(`[Recorder] Stopped recording session ${sessionId}`)

    return session
  }

  /**
   * Stop recording for a room
   */
  async stopRecordingByRoom(roomId: string): Promise<RecordingSession | null> {
    const session = Array.from(this.sessions.values()).find(
      (s) => s.roomId === roomId && (s.status === 'recording' || s.status === 'starting')
    )

    if (!session) {
      console.log(`[Recorder] No active recording found for room ${roomId}`)
      return null
    }

    return this.stopRecording(session.id)
  }

  /**
   * Get recording session by ID
   */
  getSession(sessionId: string): RecordingSession | undefined {
    return this.sessions.get(sessionId)
  }

  /**
   * Get active recording for a room
   */
  getActiveRecordingForRoom(roomId: string): RecordingSession | undefined {
    return Array.from(this.sessions.values()).find(
      (s) => s.roomId === roomId && (s.status === 'recording' || s.status === 'starting')
    )
  }

  /**
   * Get all recording sessions
   */
  getAllSessions(): RecordingSession[] {
    return Array.from(this.sessions.values())
  }

  /**
   * Cleanup old sessions
   */
  cleanupOldSessions(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now()
    for (const [id, session] of this.sessions) {
      if (
        (session.status === 'completed' || session.status === 'failed') &&
        now - session.startedAt.getTime() > maxAgeMs
      ) {
        this.sessions.delete(id)
        console.log(`[Recorder] Cleaned up old session ${id}`)
      }
    }
  }
}

// Singleton instance
export const recorder = new Recorder()
