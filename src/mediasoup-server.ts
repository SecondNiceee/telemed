/**
 * MediaSoup SFU Server
 * 
 * This server replaces PeerJS for video calls.
 * It provides:
 * - WebRTC media routing (SFU)
 * - Server-side access to media streams
 * - Foundation for server-side recording
 * 
 * Run with: pnpm mediasoup
 */

import 'dotenv/config'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import type { Socket } from 'socket.io'
import type { RtpCapabilities, DtlsParameters, RtpParameters, MediaKind } from 'mediasoup/types'
import { workerManager } from './lib/mediasoup/worker-manager'
import { roomManager } from './lib/mediasoup/room'
import { serverConfig } from './lib/mediasoup/config'
import { recorder } from './lib/mediasoup/recorder'

// Socket data interface
interface SocketData {
  peerId?: string
  peerName?: string
  role?: 'doctor' | 'patient'
  roomId?: string
  rtpCapabilities?: RtpCapabilities
}

interface AuthenticatedSocket extends Socket {
  data: SocketData
}

// Start server
async function main() {
  console.log('[MediaSoup] Starting server...')

  // Initialize MediaSoup workers
  await workerManager.initialize()

  // Create HTTP server
  const httpServer = createServer((req, res) => {
    // Health check endpoint
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok', type: 'mediasoup' }))
      return
    }
    res.writeHead(404)
    res.end()
  })

  // Create Socket.IO server
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: serverConfig.corsOrigins,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  })

  // Socket connection handler
  io.on('connection', (socket: Socket) => {
    const authSocket = socket as AuthenticatedSocket
    console.log(`[MediaSoup] Client connected: ${socket.id}`)

    // ==========================================
    // Room Management
    // ==========================================

    /**
     * Join a room (appointment)
     */
    socket.on('join-room', async (data: {
      roomId: string
      peerId: string
      peerName: string
      role: 'doctor' | 'patient'
    }, callback: (response: { 
      success: boolean
      routerRtpCapabilities?: RtpCapabilities
      error?: string 
    }) => void) => {
      try {
        const { roomId, peerId, peerName, role } = data
        console.log(`[MediaSoup] Peer ${peerId} (${role}) joining room ${roomId}`)

        // Store peer info in socket
        authSocket.data.peerId = peerId
        authSocket.data.peerName = peerName
        authSocket.data.role = role
        authSocket.data.roomId = roomId

        // Join Socket.IO room
        socket.join(roomId)

        // Get or create MediaSoup room
        const room = await roomManager.getOrCreateRoom(roomId)

        // Add peer to room
        await roomManager.addPeer(room, peerId, peerName, role)

        // Return router capabilities
        const routerRtpCapabilities = roomManager.getRouterRtpCapabilities(room)

        callback({
          success: true,
          routerRtpCapabilities,
        })

        // Notify other peers
        socket.to(roomId).emit('peer-joined', { peerId, peerName, role })

      } catch (error) {
        console.error('[MediaSoup] Join room error:', error)
        callback({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        })
      }
    })

    /**
     * Leave a room
     */
    socket.on('leave-room', (data: { roomId: string }) => {
      const { roomId } = data
      const peerId = authSocket.data.peerId

      if (peerId && roomId) {
        const room = roomManager.getRoom(roomId)
        if (room) {
          roomManager.removePeer(room, peerId)
          socket.to(roomId).emit('peer-left', { peerId })
        }
        socket.leave(roomId)
      }

      // Clear socket data
      authSocket.data.roomId = undefined
    })

    // ==========================================
    // Transport Management
    // ==========================================

    /**
     * Create WebRTC transport
     */
    socket.on('create-transport', async (data: {
      roomId: string
      direction: 'send' | 'recv'
    }, callback: (response: {
      success: boolean
      transport?: {
        id: string
        iceParameters: unknown
        iceCandidates: unknown
        dtlsParameters: unknown
        sctpParameters?: unknown
      }
      error?: string
    }) => void) => {
      try {
        const { roomId, direction } = data
        const peerId = authSocket.data.peerId

        if (!peerId) {
          throw new Error('Not authenticated')
        }

        const room = roomManager.getRoom(roomId)
        if (!room) {
          throw new Error(`Room ${roomId} not found`)
        }

        const transport = await roomManager.createWebRtcTransport(room, peerId, direction)

        callback({
          success: true,
          transport,
        })

      } catch (error) {
        console.error('[MediaSoup] Create transport error:', error)
        callback({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    })

    /**
     * Connect transport (DTLS handshake)
     */
    socket.on('connect-transport', async (data: {
      roomId: string
      transportId: string
      dtlsParameters: DtlsParameters
    }, callback: (response: { success: boolean; error?: string }) => void) => {
      try {
        const { roomId, transportId, dtlsParameters } = data
        const peerId = authSocket.data.peerId

        if (!peerId) {
          throw new Error('Not authenticated')
        }

        const room = roomManager.getRoom(roomId)
        if (!room) {
          throw new Error(`Room ${roomId} not found`)
        }

        await roomManager.connectTransport(room, peerId, transportId, dtlsParameters)

        callback({ success: true })

      } catch (error) {
        console.error('[MediaSoup] Connect transport error:', error)
        callback({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    })

    // ==========================================
    // Producer/Consumer Management
    // ==========================================

    /**
     * Create producer (start sending media)
     */
    socket.on('produce', async (data: {
      roomId: string
      transportId: string
      kind: MediaKind
      rtpParameters: RtpParameters
      appData?: Record<string, unknown>
    }, callback: (response: {
      success: boolean
      producerId?: string
      error?: string
    }) => void) => {
      try {
        const { roomId, transportId, kind, rtpParameters, appData } = data
        const peerId = authSocket.data.peerId

        if (!peerId) {
          throw new Error('Not authenticated')
        }

        const room = roomManager.getRoom(roomId)
        if (!room) {
          throw new Error(`Room ${roomId} not found`)
        }

        const { id: producerId } = await roomManager.createProducer(
          room,
          peerId,
          transportId,
          kind,
          rtpParameters,
          appData
        )

        callback({ success: true, producerId })

        // Notify other peers about new producer
        socket.to(roomId).emit('new-producer', {
          producerId,
          producerPeerId: peerId,
          kind,
        })

        // If recording is active, add this producer to the recording
        const activeRecording = recorder.getActiveRecordingForRoom(roomId)
        if (activeRecording) {
          try {
            const peer = room.peers.get(peerId)
            const producer = peer?.producers.get(producerId)
            if (producer) {
              await recorder.addProducerToRecording(activeRecording.id, room.router, producer)
              console.log(`[MediaSoup] Added new producer ${producerId} to active recording`)
            }
          } catch (err) {
            console.error(`[MediaSoup] Failed to add producer to recording:`, err)
          }
        }

      } catch (error) {
        console.error('[MediaSoup] Produce error:', error)
        callback({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    })

    /**
     * Store RTP capabilities
     */
    socket.on('set-rtp-capabilities', (data: {
      rtpCapabilities: RtpCapabilities
    }) => {
      authSocket.data.rtpCapabilities = data.rtpCapabilities
    })

    /**
     * Consume a producer (receive media from another peer)
     */
    socket.on('consume', async (data: {
      roomId: string
      producerId: string
      producerPeerId: string
    }, callback: (response: {
      success: boolean
      consumer?: {
        id: string
        producerId: string
        kind: MediaKind
        rtpParameters: RtpParameters
        producerPaused: boolean
      }
      error?: string
    }) => void) => {
      try {
        const { roomId, producerId, producerPeerId } = data
        const peerId = authSocket.data.peerId
        const rtpCapabilities = authSocket.data.rtpCapabilities

        if (!peerId || !rtpCapabilities) {
          throw new Error('Not authenticated or RTP capabilities not set')
        }

        const room = roomManager.getRoom(roomId)
        if (!room) {
          throw new Error(`Room ${roomId} not found`)
        }

        const consumer = await roomManager.createConsumer(
          room,
          peerId,
          producerPeerId,
          producerId,
          rtpCapabilities
        )

        if (!consumer) {
          throw new Error('Cannot consume this producer')
        }

        callback({ success: true, consumer })

      } catch (error) {
        console.error('[MediaSoup] Consume error:', error)
        callback({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    })

    /**
     * Resume consumer
     */
    socket.on('resume-consumer', async (data: {
      roomId: string
      consumerId: string
    }, callback: (response: { success: boolean; error?: string }) => void) => {
      try {
        const { roomId, consumerId } = data
        const peerId = authSocket.data.peerId

        if (!peerId) {
          throw new Error('Not authenticated')
        }

        const room = roomManager.getRoom(roomId)
        if (!room) {
          throw new Error(`Room ${roomId} not found`)
        }

        await roomManager.resumeConsumer(room, peerId, consumerId)

        callback({ success: true })

      } catch (error) {
        console.error('[MediaSoup] Resume consumer error:', error)
        callback({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    })

    /**
     * Get existing producers in room
     */
    socket.on('get-producers', (data: {
      roomId: string
    }, callback: (response: {
      success: boolean
      producers?: Array<{
        producerId: string
        producerPeerId: string
        kind: MediaKind
      }>
      error?: string
    }) => void) => {
      try {
        const { roomId } = data
        const peerId = authSocket.data.peerId

        if (!peerId) {
          throw new Error('Not authenticated')
        }

        const room = roomManager.getRoom(roomId)
        if (!room) {
          callback({ success: true, producers: [] })
          return
        }

        const producers: Array<{
          producerId: string
          producerPeerId: string
          kind: MediaKind
        }> = []

        for (const [pId, peer] of room.peers) {
          if (pId === peerId) continue // Skip own producers

          for (const [producerId, producer] of peer.producers) {
            producers.push({
              producerId,
              producerPeerId: pId,
              kind: producer.kind,
            })
          }
        }

        callback({ success: true, producers })

      } catch (error) {
        console.error('[MediaSoup] Get producers error:', error)
        callback({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    })

    // ==========================================
    // Recording Management
    // ==========================================

    /**
     * Start recording a room
     */
    socket.on('start-recording', async (data: {
      roomId: string
      recordingType?: 'video' | 'audio'
    }, callback: (response: {
      success: boolean
      sessionId?: string
      error?: string
    }) => void) => {
      try {
        const { roomId, recordingType = 'video' } = data
        const peerId = authSocket.data.peerId
        const role = authSocket.data.role

        if (!peerId) {
          throw new Error('Not authenticated')
        }

        // Only doctors can start recording
        if (role !== 'doctor') {
          throw new Error('Only doctors can start recording')
        }

        const room = roomManager.getRoom(roomId)
        if (!room) {
          throw new Error(`Room ${roomId} not found`)
        }

        // Extract appointmentId from roomId (format: "appointment_123")
        const appointmentIdStr = roomId.replace('appointment_', '')
        const appointmentId = parseInt(appointmentIdStr, 10)
        
        if (isNaN(appointmentId)) {
          throw new Error(`Invalid roomId format: ${roomId}`)
        }

        // Collect all producers from all peers in the room
        const allProducers = new Map<string, typeof room.peers extends Map<string, infer P> ? P extends { producers: infer Pr } ? Pr extends Map<string, infer Producer> ? Producer : never : never : never>()
        
        for (const peer of room.peers.values()) {
          for (const [producerId, producer] of peer.producers) {
            allProducers.set(producerId, producer)
          }
        }

        if (allProducers.size === 0) {
          throw new Error('No producers to record')
        }

        // Start recording with appointmentId for server-side finalization
        const session = await recorder.startRecording(roomId, room.router, allProducers as Map<string, import('mediasoup/types').Producer>, appointmentId, recordingType)

        callback({
          success: true,
          sessionId: session.id,
        })

        // Notify all peers in room that recording started
        io.to(roomId).emit('recording-started', {
          sessionId: session.id,
          startedBy: peerId,
        })

        console.log(`[MediaSoup] Recording started for room ${roomId}, session: ${session.id}`)

      } catch (error) {
        console.error('[MediaSoup] Start recording error:', error)
        callback({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    })

    /**
     * Stop recording a room - also finalizes recording to Payload CMS
     */
    socket.on('stop-recording', async (data: {
      roomId: string
    }, callback: (response: {
      success: boolean
      filePath?: string
      recordingId?: number
      error?: string
    }) => void) => {
      try {
        const { roomId } = data
        const peerId = authSocket.data.peerId
        const role = authSocket.data.role

        if (!peerId) {
          throw new Error('Not authenticated')
        }

        // Only doctors can stop recording
        if (role !== 'doctor') {
          throw new Error('Only doctors can stop recording')
        }

        const session = await recorder.stopRecordingByRoom(roomId)

        if (!session) {
          throw new Error('No active recording found')
        }

        console.log(`[MediaSoup] Recording stopped for room ${roomId}, file: ${session.filePath}`)

        // Server-side finalization - always finalize on the server
        const appointmentId = session.appointmentId
        if (appointmentId) {
          const nextJsUrl = process.env.NEXTJS_URL || 'http://localhost:3000'
          const serverSecret = process.env.MEDIASOUP_SERVER_SECRET || 'mediasoup-internal-secret'
          
          const durationSeconds = session.startedAt 
            ? Math.round((Date.now() - session.startedAt.getTime()) / 1000)
            : undefined
          
          console.log(`[MediaSoup] Finalizing recording for appointment ${appointmentId}...`)
          
          try {
            const finalizeResponse = await fetch(`${nextJsUrl}/api/mediasoup-recording/finalize-server`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                appointmentId,
                sessionId: session.id,
                durationSeconds,
                recordingType: session.recordingType || 'video',
                serverSecret,
              }),
            })
            
            const finalizeData = await finalizeResponse.json()
            
            if (finalizeData.success) {
              console.log(`[MediaSoup] Recording finalized successfully: recordingId=${finalizeData.recordingId}`)
              
              callback({
                success: true,
                filePath: session.filePath,
                recordingId: finalizeData.recordingId,
              })
              
              // Notify all peers in room that recording stopped and finalized
              io.to(roomId).emit('recording-stopped', {
                sessionId: session.id,
                filePath: session.filePath,
                recordingId: finalizeData.recordingId,
                finalized: true,
              })
            } else {
              console.error(`[MediaSoup] Failed to finalize recording:`, finalizeData.error)
              callback({
                success: true, // Recording stopped successfully, but finalization failed
                filePath: session.filePath,
                error: `Recording stopped but finalization failed: ${finalizeData.error}`,
              })
              
              io.to(roomId).emit('recording-stopped', {
                sessionId: session.id,
                filePath: session.filePath,
                finalized: false,
                error: finalizeData.error,
              })
            }
          } catch (finalizeError) {
            console.error(`[MediaSoup] Error calling finalize API:`, finalizeError)
            callback({
              success: true, // Recording stopped successfully
              filePath: session.filePath,
              error: 'Recording stopped but finalization failed',
            })
            
            io.to(roomId).emit('recording-stopped', {
              sessionId: session.id,
              filePath: session.filePath,
              finalized: false,
            })
          }
        } else {
          console.warn(`[MediaSoup] No appointmentId found for session ${session.id}, cannot finalize`)
          callback({
            success: true,
            filePath: session.filePath,
          })
          
          // Notify all peers in room that recording stopped (without finalization)
          io.to(roomId).emit('recording-stopped', {
            sessionId: session.id,
            filePath: session.filePath,
            finalized: false,
          })
        }

      } catch (error) {
        console.error('[MediaSoup] Stop recording error:', error)
        callback({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    })

    /**
     * Get recording status for a room
     */
    socket.on('get-recording-status', (data: {
      roomId: string
    }, callback: (response: {
      success: boolean
      isRecording: boolean
      sessionId?: string
      startedAt?: string
      error?: string
    }) => void) => {
      try {
        const { roomId } = data

        const session = recorder.getActiveRecordingForRoom(roomId)

        callback({
          success: true,
          isRecording: !!session,
          sessionId: session?.id,
          startedAt: session?.startedAt.toISOString(),
        })

      } catch (error) {
        console.error('[MediaSoup] Get recording status error:', error)
        callback({
          success: false,
          isRecording: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    })

    // ==========================================
    // Disconnect Handler
    // ==========================================

    socket.on('disconnect', async () => {
      const peerId = authSocket.data.peerId
      const roomId = authSocket.data.roomId
      const role = authSocket.data.role

      console.log(`[MediaSoup] Client disconnected: ${socket.id}, peerId: ${peerId}`)

      if (peerId && roomId) {
        const room = roomManager.getRoom(roomId)
        if (room) {
          roomManager.removePeer(room, peerId)
          socket.to(roomId).emit('peer-left', { peerId })

            // If doctor disconnected, stop recording
            if (role === 'doctor') {
              const session = recorder.getActiveRecordingForRoom(roomId)
              if (session) {
                console.log(`[MediaSoup] Doctor disconnected, stopping recording for room ${roomId}`)
                try {
                  await recorder.stopRecording(session.id)
                  io.to(roomId).emit('recording-stopped', {
                    sessionId: session.id,
                    filePath: session.filePath,
                    reason: 'doctor-disconnected',
                  })
                  
                  // Finalize recording by calling Next.js API
                  // Extract appointmentId from roomId (format: "appointment_123")
                  const appointmentIdStr = roomId.replace('appointment_', '')
                  const appointmentId = parseInt(appointmentIdStr, 10)
                  
                  if (!isNaN(appointmentId)) {
                    const nextJsUrl = process.env.NEXTJS_URL || 'http://localhost:3000'
                    const serverSecret = process.env.MEDIASOUP_SERVER_SECRET || 'mediasoup-internal-secret'
                    
                    console.log(`[MediaSoup] Finalizing recording for appointment ${appointmentId}...`)
                    
                    // Calculate duration from session start time
                    const durationSeconds = session.startedAt 
                      ? Math.round((Date.now() - session.startedAt.getTime()) / 1000)
                      : undefined
                    
                    fetch(`${nextJsUrl}/api/mediasoup-recording/finalize-server`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        appointmentId,
                        sessionId: session.id,
                        durationSeconds,
                        recordingType: 'video',
                        serverSecret,
                      }),
                    })
                      .then(res => res.json())
                      .then(data => {
                        if (data.success) {
                          console.log(`[MediaSoup] Recording finalized successfully: recordingId=${data.recordingId}`)
                        } else {
                          console.error(`[MediaSoup] Failed to finalize recording:`, data.error)
                        }
                      })
                      .catch(err => {
                        console.error(`[MediaSoup] Error calling finalize API:`, err)
                      })
                  }
                } catch (error) {
                  console.error('[MediaSoup] Error stopping recording on disconnect:', error)
                }
              }
            }

            // If room is now empty, ensure recording is stopped and finalized
            if (room.peers.size === 0) {
              const session = recorder.getActiveRecordingForRoom(roomId)
              if (session) {
                console.log(`[MediaSoup] Room ${roomId} is empty, stopping recording`)
                try {
                  await recorder.stopRecording(session.id)
                  
                  // Finalize recording by calling Next.js API
                  const appointmentIdStr = roomId.replace('appointment_', '')
                  const appointmentId = parseInt(appointmentIdStr, 10)
                  
                  if (!isNaN(appointmentId)) {
                    const nextJsUrl = process.env.NEXTJS_URL || 'http://localhost:3000'
                    const serverSecret = process.env.MEDIASOUP_SERVER_SECRET || 'mediasoup-internal-secret'
                    
                    const durationSeconds = session.startedAt 
                      ? Math.round((Date.now() - session.startedAt.getTime()) / 1000)
                      : undefined
                    
                    fetch(`${nextJsUrl}/api/mediasoup-recording/finalize-server`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        appointmentId,
                        sessionId: session.id,
                        durationSeconds,
                        recordingType: 'video',
                        serverSecret,
                      }),
                    })
                      .then(res => res.json())
                      .then(data => {
                        if (data.success) {
                          console.log(`[MediaSoup] Recording finalized on empty room: recordingId=${data.recordingId}`)
                        } else {
                          console.error(`[MediaSoup] Failed to finalize recording on empty room:`, data.error)
                        }
                      })
                      .catch(err => {
                        console.error(`[MediaSoup] Error calling finalize API on empty room:`, err)
                      })
                  }
                } catch (error) {
                  console.error('[MediaSoup] Error stopping recording on empty room:', error)
                }
              }
            }
        }
      }
    })
  })

  // Start listening
  httpServer.listen(serverConfig.port, () => {
    console.log(`[MediaSoup] Server listening on port ${serverConfig.port}`)
    console.log(`[MediaSoup] CORS origins: ${serverConfig.corsOrigins.join(', ')}`)
  })

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[MediaSoup] Shutting down...')
    
    // Stop all active recordings
    const activeSessions = recorder.getAllSessions().filter(
      (s) => s.status === 'recording' || s.status === 'starting'
    )
    for (const session of activeSessions) {
      console.log(`[MediaSoup] Stopping recording session ${session.id}`)
      try {
        await recorder.stopRecording(session.id)
      } catch (error) {
        console.error(`[MediaSoup] Error stopping recording ${session.id}:`, error)
      }
    }
    
    // Close all rooms
    for (const [roomId] of roomManager.getAllRooms()) {
      roomManager.closeRoom(roomId)
    }
    
    // Close workers
    await workerManager.close()
    
    // Close HTTP server
    httpServer.close()
    
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((error) => {
  console.error('[MediaSoup] Fatal error:', error)
  process.exit(1)
})
