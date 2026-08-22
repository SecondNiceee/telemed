import type {
  MediaKind,
  PlainTransport,
  Producer,
  Router,
  RtpCapabilities,
  RtpParameters,
  WebRtcTransport,
} from 'mediasoup/types'
import { plainTransportOptions, routerOptions, webRtcTransportOptions } from './config'
import { Peer, type PeerRole } from './peer'
import { recordingController } from './recording-controller'
import { workerManager } from './worker-manager'

export interface Room {
  id: string
  router: Router
  peers: Map<string, Peer>
  createdAt: Date
  recordingTransport?: PlainTransport
  recordingProducers?: Map<string, Producer>
}

export class RoomManager {
  private readonly rooms = new Map<string, Room>()
  private readonly pendingRooms = new Map<string, Promise<Room>>()
  private readonly closeTimers = new Map<string, NodeJS.Timeout>()
  private readonly emptyRoomGraceMs = 30_000

  async createRoom(roomId: string): Promise<Room> {
    const existing = this.rooms.get(roomId)
    if (existing) return existing

    const pending = this.pendingRooms.get(roomId)
    if (pending) return pending

    const creation = (async () => {
      const router = await workerManager.getNextWorker().createRouter(routerOptions)
      const room: Room = { id: roomId, router, peers: new Map(), createdAt: new Date() }
      this.rooms.set(roomId, room)
      console.log(`[Room] Created room ${roomId}`)
      return room
    })()

    this.pendingRooms.set(roomId, creation)
    try {
      return await creation
    } finally {
      this.pendingRooms.delete(roomId)
    }
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId)
  }

  async getOrCreateRoom(roomId: string): Promise<Room> {
    return this.rooms.get(roomId) ?? this.createRoom(roomId)
  }

  async addPeer(room: Room, peerId: string, peerName: string, role: PeerRole): Promise<Peer> {
    const closeTimer = this.closeTimers.get(room.id)
    if (closeTimer) {
      clearTimeout(closeTimer)
      this.closeTimers.delete(room.id)
    }

    const existing = room.peers.get(peerId)
    if (existing) {
      // Session rebuild (e.g. network switch): the old producers are about to
      // die, so finalize the current segment. A new one starts when both
      // participants publish again.
      recordingController.onPeerLeft(room)
      existing.close()
    }

    const peer = new Peer(peerId, peerName, role)
    room.peers.set(peerId, peer)
    return peer
  }

  removePeer(room: Room, peerId: string): boolean {
    const peer = room.peers.get(peerId)
    if (!peer) return false

    // Stop and finalize the current recording segment BEFORE the peer's
    // producers are closed, so FFmpeg receives every last frame.
    recordingController.onPeerLeft(room)

    peer.close()
    room.peers.delete(peerId)
    if (room.peers.size === 0 && !this.closeTimers.has(room.id)) {
      const timer = setTimeout(() => {
        this.closeTimers.delete(room.id)
        if (room.peers.size === 0) this.closeRoom(room.id)
      }, this.emptyRoomGraceMs)
      timer.unref()
      this.closeTimers.set(room.id, timer)
    }
    return true
  }

  async createWebRtcTransport(room: Room, peerId: string, direction: 'send' | 'recv') {
    const peer = this.requirePeer(room, peerId)
    const transport = await room.router.createWebRtcTransport(webRtcTransportOptions)
    peer.replaceTransport(transport, direction)

    const remove = () => {
      peer.transports.delete(transport.id)
      peer.transportDirections.delete(transport.id)
    }
    transport.on('dtlsstatechange', (state) => {
      if (state === 'closed' || state === 'failed') transport.close()
    })
    transport.on('@close', remove)

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
      sctpParameters: transport.sctpParameters,
    }
  }

  async connectTransport(room: Room, peerId: string, transportId: string, dtlsParameters: WebRtcTransport['dtlsParameters']): Promise<void> {
    const transport = this.requireTransport(room, peerId, transportId)
    await transport.connect({ dtlsParameters })
  }

  async restartIce(room: Room, peerId: string, transportId: string) {
    return this.requireTransport(room, peerId, transportId).restartIce()
  }

  async createProducer(
    room: Room,
    peerId: string,
    transportId: string,
    kind: MediaKind,
    rtpParameters: RtpParameters,
    appData?: Record<string, unknown>,
  ): Promise<{ id: string }> {
    const peer = this.requirePeer(room, peerId)
    const transport = this.requireTransport(room, peerId, transportId, 'send')
    const producer = await transport.produce({
      kind,
      rtpParameters,
      appData: { ...appData, peerId, peerName: peer.name },
    })
    peer.producers.set(producer.id, producer)
    producer.on('transportclose', () => peer.producers.delete(producer.id))
    recordingController.onProducersChanged(room)
    return { id: producer.id }
  }

  getProducers(room: Room, excludingPeerId?: string): Array<{ producerId: string; producerPeerId: string; kind: MediaKind }> {
    const producers: Array<{ producerId: string; producerPeerId: string; kind: MediaKind }> = []
    for (const [peerId, peer] of room.peers) {
      if (peerId === excludingPeerId) continue
      for (const producer of peer.producers.values()) {
        producers.push({ producerId: producer.id, producerPeerId: peerId, kind: producer.kind })
      }
    }
    return producers
  }

  async createConsumer(
    room: Room,
    consumerPeerId: string,
    producerPeerId: string,
    producerId: string,
    rtpCapabilities: RtpCapabilities,
  ) {
    const consumerPeer = this.requirePeer(room, consumerPeerId)
    const producerPeer = this.requirePeer(room, producerPeerId)
    const producer = producerPeer.producers.get(producerId)
    if (!producer) throw new Error(`Producer ${producerId} not found`)
    if (!room.router.canConsume({ producerId, rtpCapabilities })) return null

    const recvTransportEntry = [...consumerPeer.transportDirections.entries()].find(([, direction]) => direction === 'recv')
    const recvTransport = recvTransportEntry ? consumerPeer.getTransport(recvTransportEntry[0], 'recv') : undefined
    if (!recvTransport) throw new Error('Receive transport not found')

    const consumer = await recvTransport.consume({ producerId, rtpCapabilities, paused: true })
    consumerPeer.consumers.set(consumer.id, consumer)
    const remove = () => consumerPeer.consumers.delete(consumer.id)
    consumer.on('transportclose', remove)
    consumer.on('producerclose', remove)

    return {
      id: consumer.id,
      producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      producerPaused: consumer.producerPaused,
    }
  }

  async resumeConsumer(room: Room, peerId: string, consumerId: string): Promise<void> {
    const consumer = this.requirePeer(room, peerId).consumers.get(consumerId)
    if (!consumer) throw new Error(`Consumer ${consumerId} not found`)
    await consumer.resume()
  }

  async setProducerPaused(room: Room, peerId: string, producerId: string, paused: boolean): Promise<void> {
    const producer = this.requireOwnedProducer(room, peerId, producerId)
    if (paused) await producer.pause()
    else await producer.resume()
  }

  closeProducer(room: Room, peerId: string, producerId: string): void {
    const producer = this.requireOwnedProducer(room, peerId, producerId)
    producer.close()
    this.requirePeer(room, peerId).producers.delete(producerId)
  }

  closeRoom(roomId: string): void {
    const timer = this.closeTimers.get(roomId)
    if (timer) clearTimeout(timer)
    this.closeTimers.delete(roomId)
    const room = this.rooms.get(roomId)
    if (!room) return
    for (const peer of room.peers.values()) peer.close()
    room.peers.clear()
    this.rooms.delete(roomId)
    // Finalize any in-flight recording, then close the router.
    void recordingController.onRoomClosing(roomId).finally(() => {
      if (!room.router.closed) room.router.close()
    })
  }

  closeAllRooms(): void {
    for (const roomId of [...this.rooms.keys()]) this.closeRoom(roomId)
  }

  getRouterRtpCapabilities(room: Room): RtpCapabilities {
    return room.router.rtpCapabilities
  }

  getAllRooms(): Map<string, Room> {
    return this.rooms
  }

  getRoomStats(roomId: string) {
    const room = this.rooms.get(roomId)
    if (!room) return null
    return {
      peersCount: room.peers.size,
      peers: [...room.peers.values()].map((peer) => ({
        id: peer.id,
        name: peer.name,
        role: peer.role,
        producersCount: peer.producers.size,
        consumersCount: peer.consumers.size,
      })),
    }
  }

  private requirePeer(room: Room, peerId: string): Peer {
    const peer = room.peers.get(peerId)
    if (!peer || peer.isClosed) throw new Error(`Peer ${peerId} not found in room ${room.id}`)
    return peer
  }

  private requireTransport(room: Room, peerId: string, transportId: string, direction?: 'send' | 'recv'): WebRtcTransport {
    const transport = this.requirePeer(room, peerId).getTransport(transportId, direction)
    if (!transport) throw new Error(`Transport ${transportId} not found`)
    return transport as WebRtcTransport
  }

  private requireOwnedProducer(room: Room, peerId: string, producerId: string): Producer {
    const producer = this.requirePeer(room, peerId).producers.get(producerId)
    if (!producer) throw new Error(`Producer ${producerId} is not owned by peer ${peerId}`)
    return producer
  }
}

export { plainTransportOptions }
export const roomManager = new RoomManager()
