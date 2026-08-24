import 'dotenv/config'
import { createServer } from 'node:http'
import { Server as SocketIOServer } from 'socket.io'
import { serverConfig } from './lib/mediasoup/config'
import { registerMediaSignaling } from './lib/mediasoup/handlers/signaling'
import { roomManager } from './lib/mediasoup/room'
import { verifyRoomToken } from './lib/mediasoup/room-token'
import { workerManager } from './lib/mediasoup/worker-manager'

async function main() {
  if (!process.env.MEDIASOUP_SERVER_SECRET || process.env.MEDIASOUP_SERVER_SECRET.length < 32) {
    throw new Error('MEDIASOUP_SERVER_SECRET must be configured with at least 32 characters')
  }

  await workerManager.initialize()

  const httpServer = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok', type: 'mediasoup', rooms: roomManager.getAllRooms().size }))
      return
    }

    // `state` отвечает, есть ли в комнате кто-то кроме запрашивающего. Нужно,
    // чтобы участник, вернувшийся по старой ссылке звонка, понял: комната уже
    // закрыта, ждать там некого.
    const roomActionMatch = req.method === 'POST' ? req.url?.match(/^\/rooms\/(appointment_\d+)\/(leave|state)$/) : null
    if (!roomActionMatch) {
      res.writeHead(404)
      res.end()
      return
    }

    let rawBody = ''
    req.setEncoding('utf8')
    req.on('data', (chunk: string) => {
      rawBody += chunk
      if (rawBody.length > 16_384) req.destroy()
    })
    req.on('end', () => {
      try {
        const body = JSON.parse(rawBody) as { token?: string; peerId?: string }
        if (!body.token || !body.peerId) throw new Error('token and peerId are required')
        const roomId = roomActionMatch[1]
        const claims = verifyRoomToken(body.token, { roomId, peerId: body.peerId })
        const room = roomManager.getRoom(roomId)

        if (roomActionMatch[2] === 'state') {
          // Сама комната живёт ещё 30 секунд после выхода последнего участника,
          // поэтому её существование ни о чём не говорит - смотрим именно на
          // присутствие второго участника.
          const peerIds = room ? [...room.peers.keys()] : []
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            success: true,
            roomExists: room !== undefined,
            otherPeerPresent: peerIds.some((peerId) => peerId !== claims.peerId),
          }))
          return
        }

        const removed = room ? roomManager.removePeer(room, claims.peerId) : false
        if (removed) io.to(roomId).emit('peerLeft', { peerId: claims.peerId })
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true }))
      } catch (error) {
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unauthorized' }))
      }
    })
  })

  const io = new SocketIOServer(httpServer, {
    path: process.env.MEDIASOUP_SOCKET_PATH || '/socket.io',
    cors: { origin: serverConfig.corsOrigins, credentials: true },
    transports: ['websocket', 'polling'],
  })

  io.on('connection', (socket) => registerMediaSignaling(io, socket as Parameters<typeof registerMediaSignaling>[1]))
  httpServer.listen(serverConfig.port, () => console.log(`[MediaSoup] Listening on port ${serverConfig.port}`))

  const shutdown = async () => {
    io.close()
    roomManager.closeAllRooms()
    await workerManager.close()
    httpServer.close(() => process.exit(0))
  }
  process.once('SIGINT', () => void shutdown())
  process.once('SIGTERM', () => void shutdown())
}

main().catch((error) => {
  console.error('[MediaSoup] Fatal error:', error)
  process.exit(1)
})
