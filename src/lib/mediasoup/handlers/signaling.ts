import type { Server, Socket } from 'socket.io'
import type { DtlsParameters, MediaKind, RtpCapabilities, RtpParameters } from 'mediasoup/types'
import { roomManager } from '../room'
import { verifyRoomToken } from '../room-token'

interface MediaSocketData {
  peerId?: string
  peerName?: string
  role?: 'doctor' | 'patient'
  roomId?: string
  rtpCapabilities?: RtpCapabilities
}

type MediaSocket = Socket<Record<string, never>, Record<string, never>, Record<string, never>, MediaSocketData>
type Ack<T extends object = Record<string, never>> = (response: ({ success: true } & T) | { success: false; error: string }) => void

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}

function inRoom(socket: MediaSocket, roomId: string) {
  if (!socket.data.peerId || socket.data.roomId !== roomId) throw new Error('Socket is not joined to this room')
  const room = roomManager.getRoom(roomId)
  if (!room || !room.peers.has(socket.data.peerId)) throw new Error(`Room ${roomId} not found`)
  return { room, peerId: socket.data.peerId }
}

function handle<T extends object>(ack: Ack<T>, operation: () => Promise<T> | T): void {
  Promise.resolve()
    .then(operation)
    .then((result) => ack({ success: true, ...result }))
    .catch((error) => ack({ success: false, error: errorMessage(error) }))
}

export function registerMediaSignaling(io: Server, socket: MediaSocket): void {
  socket.on('joinRoom', (data: { token?: string; roomId?: string; peerId?: string }, ack: Ack<{ routerRtpCapabilities: RtpCapabilities }>) => {
    handle(ack, async () => {
      if (!data?.token || !data.roomId || !data.peerId) throw new Error('token, roomId and peerId are required')
      if (socket.data.roomId && socket.data.roomId !== data.roomId) throw new Error('Socket has already joined another room')

      const claims = verifyRoomToken(data.token, { roomId: data.roomId, peerId: data.peerId })
      const room = await roomManager.getOrCreateRoom(claims.roomId)
      await roomManager.addPeer(room, claims.peerId, claims.peerName, claims.role)

      socket.data.peerId = claims.peerId
      socket.data.peerName = claims.peerName
      socket.data.role = claims.role
      socket.data.roomId = claims.roomId
      await socket.join(claims.roomId)
      socket.to(claims.roomId).emit('peerJoined', { peerId: claims.peerId, peerName: claims.peerName, role: claims.role })
      return { routerRtpCapabilities: roomManager.getRouterRtpCapabilities(room) }
    })
  })

  socket.on('createWebRtcTransport', (data: { roomId: string; direction: 'send' | 'recv' }, ack: Ack<{ transport: Awaited<ReturnType<typeof roomManager.createWebRtcTransport>> }>) => {
    handle(ack, async () => {
      if (data.direction !== 'send' && data.direction !== 'recv') throw new Error('Invalid transport direction')
      const { room, peerId } = inRoom(socket, data.roomId)
      return { transport: await roomManager.createWebRtcTransport(room, peerId, data.direction) }
    })
  })

  socket.on('connectTransport', (data: { roomId: string; transportId: string; dtlsParameters: DtlsParameters }, ack: Ack) => {
    handle(ack, async () => {
      const { room, peerId } = inRoom(socket, data.roomId)
      await roomManager.connectTransport(room, peerId, data.transportId, data.dtlsParameters)
      return {}
    })
  })

  socket.on('restartIce', (data: { roomId: string; transportId: string }, ack: Ack<{ iceParameters: Awaited<ReturnType<typeof roomManager.restartIce>> }>) => {
    handle(ack, async () => {
      const { room, peerId } = inRoom(socket, data.roomId)
      return { iceParameters: await roomManager.restartIce(room, peerId, data.transportId) }
    })
  })

  socket.on('produce', (data: { roomId: string; transportId: string; kind: MediaKind; rtpParameters: RtpParameters; appData?: Record<string, unknown> }, ack: Ack<{ producerId: string }>) => {
    handle(ack, async () => {
      const { room, peerId } = inRoom(socket, data.roomId)
      const { id: producerId } = await roomManager.createProducer(room, peerId, data.transportId, data.kind, data.rtpParameters, data.appData)
      socket.to(data.roomId).emit('newProducer', { producerId, producerPeerId: peerId, kind: data.kind, appData: data.appData })
      return { producerId }
    })
  })

  socket.on('getProducers', (data: { roomId: string }, ack: Ack<{ producers: ReturnType<typeof roomManager.getProducers> }>) => {
    handle(ack, () => {
      const { room, peerId } = inRoom(socket, data.roomId)
      return { producers: roomManager.getProducers(room, peerId) }
    })
  })

  socket.on('consume', (data: { roomId: string; producerId: string; producerPeerId: string; rtpCapabilities: RtpCapabilities }, ack: Ack<{ consumer: NonNullable<Awaited<ReturnType<typeof roomManager.createConsumer>>> }>) => {
    handle(ack, async () => {
      const { room, peerId } = inRoom(socket, data.roomId)
      const consumer = await roomManager.createConsumer(room, peerId, data.producerPeerId, data.producerId, data.rtpCapabilities)
      if (!consumer) throw new Error('Cannot consume this producer')
      return { consumer }
    })
  })

  socket.on('resumeConsumer', (data: { roomId: string; consumerId: string }, ack: Ack) => {
    handle(ack, async () => {
      const { room, peerId } = inRoom(socket, data.roomId)
      await roomManager.resumeConsumer(room, peerId, data.consumerId)
      return {}
    })
  })

  for (const [event, paused] of [['pauseProducer', true], ['resumeProducer', false]] as const) {
    socket.on(event, (data: { roomId: string; producerId: string }, ack: Ack) => {
      handle(ack, async () => {
        const { room, peerId } = inRoom(socket, data.roomId)
        await roomManager.setProducerPaused(room, peerId, data.producerId, paused)
        return {}
      })
    })
  }

  socket.on('closeProducer', (data: { roomId: string; producerId: string }, ack: Ack) => {
    handle(ack, () => {
      const { room, peerId } = inRoom(socket, data.roomId)
      roomManager.closeProducer(room, peerId, data.producerId)
      socket.to(data.roomId).emit('producerClosed', { producerId: data.producerId, producerPeerId: peerId })
      return {}
    })
  })

  const leave = () => {
    const { roomId, peerId } = socket.data
    if (!roomId || !peerId) return false
    const room = roomManager.getRoom(roomId)
    const removed = room ? roomManager.removePeer(room, peerId) : false
    void socket.leave(roomId)
    if (removed) socket.to(roomId).emit('peerLeft', { peerId })
    socket.data.roomId = undefined
    socket.data.peerId = undefined
    return removed
  }

  socket.on('leaveRoom', (_data: unknown, ack: Ack) => handle(ack, () => { leave(); return {} }))
  socket.on('disconnect', leave)
}
