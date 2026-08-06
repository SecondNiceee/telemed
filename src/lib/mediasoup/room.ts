/**
 * MediaSoup Room Manager
 * 
 * Manages rooms (video call sessions) and participants (peers).
 * Each room has its own Router for media routing.
 * 
 * SINGLE PORT MODE:
 * All transports are created via WebRtcServer, sharing a single port (40000).
 * No need to open thousands of UDP ports!
 */

import type { 
  Router, 
  Producer, 
  Consumer, 
  Transport,
  WebRtcTransport,
  PlainTransport,
  RtpCapabilities,
  RtpParameters,
  MediaKind,
  WebRtcServer,
} from 'mediasoup/types'
import { workerManager } from './worker-manager'
import { routerOptions, webRtcTransportOptions, plainTransportOptions } from './config'

/**
 * Peer represents a participant in a room
 */
export interface Peer {
  id: string
  name: string
  role: 'doctor' | 'patient'
  transports: Map<string, Transport>
  producers: Map<string, Producer>
  consumers: Map<string, Consumer>
  rtpCapabilities?: RtpCapabilities
}

/**
 * Room represents a video call session (appointment)
 */
export interface Room {
  id: string // appointmentId
  router: Router
  webRtcServer?: WebRtcServer // Shared WebRtcServer for single-port mode
  workerIndex: number // Which worker this room is assigned to
  peers: Map<string, Peer>
  createdAt: Date
  // For server-side recording
  recordingTransport?: PlainTransport
  recordingProducers?: Map<string, Producer>
}

class RoomManager {
  private rooms: Map<string, Room> = new Map()

  /**
   * Create a new room for an appointment
   * 
   * Uses WebRtcServer for single-port mode (all transports share port 40000)
   */
  async createRoom(appointmentId: string): Promise<Room> {
    // Check if room already exists
    const existingRoom = this.rooms.get(appointmentId)
    if (existingRoom) {
      console.log(`[Room] Room ${appointmentId} already exists`)
      return existingRoom
    }

    // Get worker WITH its WebRtcServer to ensure they match!
    // This is critical - Router and WebRtcServer MUST be from the same worker
    const { worker, webRtcServer, workerIndex } = workerManager.getNextWorkerWithServer()
    const router = await worker.createRouter(routerOptions)
    
    const room: Room = {
      id: appointmentId,
      router,
      webRtcServer,
      workerIndex,
      peers: new Map(),
      createdAt: new Date(),
    }

    this.rooms.set(appointmentId, room)
    
    if (room.webRtcServer) {
      console.log(`[Room] Created room ${appointmentId} on worker ${workerIndex} (single-port mode via WebRtcServer)`)
    } else {
      console.log(`[Room] Created room ${appointmentId} on worker ${workerIndex} (fallback: individual ports)`)
    }

    return room
  }

  /**
   * Get an existing room
   */
  getRoom(appointmentId: string): Room | undefined {
    return this.rooms.get(appointmentId)
  }

  /**
   * Get or create a room
   */
  async getOrCreateRoom(appointmentId: string): Promise<Room> {
    const room = this.getRoom(appointmentId)
    if (room) return room
    return this.createRoom(appointmentId)
  }

  /**
   * Add a peer to a room
   */
  async addPeer(
    room: Room, 
    peerId: string, 
    peerName: string, 
    role: 'doctor' | 'patient'
  ): Promise<Peer> {
    // Check if peer already exists
    const existingPeer = room.peers.get(peerId)
    if (existingPeer) {
      console.log(`[Room] Peer ${peerId} already in room ${room.id}`)
      return existingPeer
    }

    const peer: Peer = {
      id: peerId,
      name: peerName,
      role,
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
    }

    room.peers.set(peerId, peer)
    console.log(`[Room] Peer ${peerId} (${role}) joined room ${room.id}`)

    return peer
  }

  /**
   * Remove a peer from a room
   */
  removePeer(room: Room, peerId: string): void {
    const peer = room.peers.get(peerId)
    if (!peer) return

    // Close all transports (this also closes producers and consumers)
    for (const transport of peer.transports.values()) {
      transport.close()
    }

    room.peers.delete(peerId)
    console.log(`[Room] Peer ${peerId} left room ${room.id}`)

    // If room is empty, close it after a delay
    if (room.peers.size === 0) {
      setTimeout(() => {
        const currentRoom = this.rooms.get(room.id)
        if (currentRoom && currentRoom.peers.size === 0) {
          this.closeRoom(room.id)
        }
      }, 30000) // 30 seconds delay before closing empty room
    }
  }

  /**
   * Create a WebRTC transport for a peer
   * 
   * SINGLE PORT MODE: Uses WebRtcServer so all transports share one port (40000)
   * FALLBACK MODE: Uses individual ports from rtcMinPort-rtcMaxPort range
   */
  async createWebRtcTransport(
    room: Room, 
    peerId: string, 
    direction: 'send' | 'recv'
  ): Promise<{
    id: string
    iceParameters: WebRtcTransport['iceParameters']
    iceCandidates: WebRtcTransport['iceCandidates']
    dtlsParameters: WebRtcTransport['dtlsParameters']
    sctpParameters?: WebRtcTransport['sctpParameters']
  }> {
    const peer = room.peers.get(peerId)
    if (!peer) {
      throw new Error(`Peer ${peerId} not found in room ${room.id}`)
    }

    let transport: WebRtcTransport

    // Use WebRtcServer for single-port mode (preferred)
    if (room.webRtcServer) {
      const { listenInfos: _, listenIps: __, port: ___, ...optionsWithoutListen } = webRtcTransportOptions
      transport = await room.router.createWebRtcTransport({
        ...optionsWithoutListen,
        webRtcServer: room.webRtcServer,
      })
      console.log(`[Room] Created ${direction} transport ${transport.id} for peer ${peerId} (single-port mode)`)
    } else {
      // Fallback: individual ports
      transport = await room.router.createWebRtcTransport(webRtcTransportOptions)
      console.log(`[Room] Created ${direction} transport ${transport.id} for peer ${peerId} (fallback mode)`)
    }

    // Store transport with direction suffix
    const transportKey = `${transport.id}-${direction}`
    peer.transports.set(transportKey, transport)

    transport.on('dtlsstatechange', (dtlsState) => {
      if (dtlsState === 'closed') {
        transport.close()
        peer.transports.delete(transportKey)
      }
    })

    transport.on('@close', () => {
      peer.transports.delete(transportKey)
    })

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
      sctpParameters: transport.sctpParameters,
    }
  }

  /**
   * Connect a transport (complete DTLS handshake)
   */
  async connectTransport(
    room: Room,
    peerId: string,
    transportId: string,
    dtlsParameters: WebRtcTransport['dtlsParameters']
  ): Promise<void> {
    const peer = room.peers.get(peerId)
    if (!peer) {
      throw new Error(`Peer ${peerId} not found`)
    }

    // Find transport by ID (ignoring direction suffix)
    let transport: Transport | undefined
    for (const [key, t] of peer.transports) {
      if (key.startsWith(transportId)) {
        transport = t
        break
      }
    }

    if (!transport) {
      throw new Error(`Transport ${transportId} not found`)
    }

    await (transport as WebRtcTransport).connect({ dtlsParameters })
    console.log(`[Room] Connected transport ${transportId} for peer ${peerId}`)
  }

  /**
   * Create a producer (client starts sending media)
   */
  async createProducer(
    room: Room,
    peerId: string,
    transportId: string,
    kind: MediaKind,
    rtpParameters: RtpParameters,
    appData?: Record<string, unknown>
  ): Promise<{ id: string }> {
    const peer = room.peers.get(peerId)
    if (!peer) {
      throw new Error(`Peer ${peerId} not found`)
    }

    // Find send transport
    let transport: Transport | undefined
    for (const [key, t] of peer.transports) {
      if (key.startsWith(transportId)) {
        transport = t
        break
      }
    }

    if (!transport) {
      throw new Error(`Transport ${transportId} not found`)
    }

    const producer = await (transport as WebRtcTransport).produce({
      kind,
      rtpParameters,
      appData: { ...appData, peerId, peerName: peer.name },
    })

    peer.producers.set(producer.id, producer)

    producer.on('transportclose', () => {
      peer.producers.delete(producer.id)
    })

    console.log(`[Room] Created ${kind} producer ${producer.id} for peer ${peerId}`)

    // Notify other peers to consume this producer
    this.notifyNewProducer(room, peerId, producer)

    return { id: producer.id }
  }

  /**
   * Notify other peers about a new producer
   */
  private notifyNewProducer(room: Room, producerPeerId: string, producer: Producer): void {
    // This will be handled by socket events - just log for now
    console.log(`[Room] New producer ${producer.id} (${producer.kind}) from peer ${producerPeerId} in room ${room.id}`)
  }

  /**
   * Create a consumer (client starts receiving media from another peer)
   */
  async createConsumer(
    room: Room,
    consumerPeerId: string,
    producerPeerId: string,
    producerId: string,
    rtpCapabilities: RtpCapabilities
  ): Promise<{
    id: string
    producerId: string
    kind: MediaKind
    rtpParameters: RtpParameters
    producerPaused: boolean
  } | null> {
    const consumerPeer = room.peers.get(consumerPeerId)
    const producerPeer = room.peers.get(producerPeerId)

    if (!consumerPeer || !producerPeer) {
      throw new Error('Peer not found')
    }

    const producer = producerPeer.producers.get(producerId)
    if (!producer) {
      throw new Error(`Producer ${producerId} not found`)
    }

    // Check if the consumer can consume this producer
    if (!room.router.canConsume({ producerId: producer.id, rtpCapabilities })) {
      console.warn(`[Room] Peer ${consumerPeerId} cannot consume producer ${producerId}`)
      return null
    }

    // Find receive transport
    let recvTransport: WebRtcTransport | undefined
    for (const [key, t] of consumerPeer.transports) {
      if (key.includes('recv')) {
        recvTransport = t as WebRtcTransport
        break
      }
    }

    if (!recvTransport) {
      throw new Error('Receive transport not found')
    }

    const consumer = await recvTransport.consume({
      producerId: producer.id,
      rtpCapabilities,
      paused: true, // Start paused, client will resume
    })

    consumerPeer.consumers.set(consumer.id, consumer)

    consumer.on('transportclose', () => {
      consumerPeer.consumers.delete(consumer.id)
    })

    consumer.on('producerclose', () => {
      consumerPeer.consumers.delete(consumer.id)
    })

    console.log(`[Room] Created consumer ${consumer.id} for peer ${consumerPeerId} consuming ${producer.kind} from ${producerPeerId}`)

    return {
      id: consumer.id,
      producerId: producer.id,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      producerPaused: consumer.producerPaused,
    }
  }

  /**
   * Resume a consumer
   */
  async resumeConsumer(room: Room, peerId: string, consumerId: string): Promise<void> {
    const peer = room.peers.get(peerId)
    if (!peer) {
      throw new Error(`Peer ${peerId} not found`)
    }

    const consumer = peer.consumers.get(consumerId)
    if (!consumer) {
      throw new Error(`Consumer ${consumerId} not found`)
    }

    await consumer.resume()
    console.log(`[Room] Resumed consumer ${consumerId} for peer ${peerId}`)
  }

  /**
   * Close a room
   */
  closeRoom(appointmentId: string): void {
    const room = this.rooms.get(appointmentId)
    if (!room) return

    // Close all peer transports
    for (const peer of room.peers.values()) {
      for (const transport of peer.transports.values()) {
        transport.close()
      }
    }

    // Close router
    room.router.close()

    this.rooms.delete(appointmentId)
    console.log(`[Room] Closed room ${appointmentId}`)
  }

  /**
   * Get router RTP capabilities for a room
   */
  getRouterRtpCapabilities(room: Room): RtpCapabilities {
    return room.router.rtpCapabilities
  }

  /**
   * Get all rooms
   */
  getAllRooms(): Map<string, Room> {
    return this.rooms
  }

  /**
   * Get room statistics
   */
  getRoomStats(appointmentId: string): {
    peersCount: number
    peers: Array<{
      id: string
      name: string
      role: string
      producersCount: number
      consumersCount: number
    }>
  } | null {
    const room = this.rooms.get(appointmentId)
    if (!room) return null

    return {
      peersCount: room.peers.size,
      peers: Array.from(room.peers.values()).map((peer) => ({
        id: peer.id,
        name: peer.name,
        role: peer.role,
        producersCount: peer.producers.size,
        consumersCount: peer.consumers.size,
      })),
    }
  }
}

// Singleton instance
export const roomManager = new RoomManager()
