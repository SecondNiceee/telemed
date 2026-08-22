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

// A reconnect creates a new Socket.IO socket for the same logical peer. Track
// ownership so a late disconnect from the old socket cannot remove the new peer.
const peerSocketOwners = new Map<string, string>()
const peerDisconnectTimers = new Map<string, NodeJS.Timeout>()
const peerOwnerKey = (roomId: string, peerId: string) => `${roomId}:${peerId}`
const disconnectGraceMs = 10_000

function cancelDisconnectTimer(ownerKey: string): void {
  const timer = peerDisconnectTimers.get(ownerKey)
  if (!timer) return
  clearTimeout(timer)
  peerDisconnectTimers.delete(ownerKey)
}

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
      const ownerKey = peerOwnerKey(claims.roomId, claims.peerId)
      cancelDisconnectTimer(ownerKey)
      const isSameSocketJoin =
        socket.data.roomId === claims.roomId &&
        socket.data.peerId === claims.peerId &&
        peerSocketOwners.get(ownerKey) === socket.id &&
        room.peers.has(claims.peerId)

      if (!isSameSocketJoin) {
        await roomManager.addPeer(room, claims.peerId, claims.peerName, claims.role)
      }

      socket.data.peerId = claims.peerId
      socket.data.peerName = claims.peerName
      socket.data.role = claims.role
      socket.data.roomId = claims.roomId
      peerSocketOwners.set(ownerKey, socket.id)
      await socket.join(claims.roomId)
      if (!isSameSocketJoin) {
        socket.to(claims.roomId).emit('peerJoined', { peerId: claims.peerId, peerName: claims.peerName, role: claims.role })
      }
      console.log(`[MediaSoup] joined socket=${socket.id} room=${claims.roomId} peer=${claims.peerId} repeat=${isSameSocketJoin}`)
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

  socket.on('mediaState', (data: { roomId: string; micEnabled: boolean; cameraEnabled: boolean }, ack: Ack) => {
    handle(ack, () => {
      const { peerId } = inRoom(socket, data.roomId)
      socket.to(data.roomId).emit('peerMediaState', {
        peerId,
        micEnabled: data.micEnabled === true,
        cameraEnabled: data.cameraEnabled === true,
      })
      return {}
    })
  })

  socket.on('closeProducer', (data: { roomId: string; producerId: string }, ack: Ack) => {
    handle(ack, () => {
      const { room, peerId } = inRoom(socket, data.roomId)
      roomManager.closeProducer(room, peerId, data.producerId)
      socket.to(data.roomId).emit('producerClosed', { producerId: data.producerId, producerPeerId: peerId })
      return {}
    })
  })

  const removeOwnedPeer = (reason: 'participant-ended' | 'participant-disconnected') => {
    const { roomId, peerId } = socket.data
    if (!roomId || !peerId) return false

    const ownerKey = peerOwnerKey(roomId, peerId)
    const ownsPeer = peerSocketOwners.get(ownerKey) === socket.id
    if (!ownsPeer) return false

    cancelDisconnectTimer(ownerKey)
    peerSocketOwners.delete(ownerKey)
    const room = roomManager.getRoom(roomId)
    const removed = room ? roomManager.removePeer(room, peerId) : false
    if (removed) {
      socket.to(roomId).emit(reason === 'participant-ended' ? 'participantEnded' : 'participantDisconnected', { peerId })
    }
    console.log(`[MediaSoup] removed socket=${socket.id} room=${roomId} peer=${peerId} reason=${reason} removed=${removed}`)
    return removed
  }

  socket.on('endCall', (_data: unknown, ack: Ack) => {
    handle(ack, () => {
      removeOwnedPeer('participant-ended')
      void socket.leave(socket.data.roomId ?? '')
      socket.data.roomId = undefined
      socket.data.peerId = undefined
      return {}
    })
  })

  // Kept for backwards compatibility. An explicit leave means the participant
  // intentionally ended the call, while a disconnect receives a reconnect grace period.
  socket.on('leaveRoom', (_data: unknown, ack: Ack) => {
    handle(ack, () => {
      removeOwnedPeer('participant-ended')
      return {}
    })
  })

  socket.on('disconnect', () => {
    const { roomId, peerId } = socket.data
    if (!roomId || !peerId) return
    const ownerKey = peerOwnerKey(roomId, peerId)
    if (peerSocketOwners.get(ownerKey) !== socket.id) return

    cancelDisconnectTimer(ownerKey)
    const timer = setTimeout(() => {
      peerDisconnectTimers.delete(ownerKey)
      removeOwnedPeer('participant-disconnected')
    }, disconnectGraceMs)
    timer.unref()
    peerDisconnectTimers.set(ownerKey, timer)
    console.log(`[MediaSoup] disconnect grace socket=${socket.id} room=${roomId} peer=${peerId} timeout=${disconnectGraceMs}`)
  })
}
