import 'dotenv/config'
import http from 'http'
import next from 'next'
import { Server as SocketIOServer } from 'socket.io'
import { getPayload } from 'payload'
import config from '@payload-config'
import { initializeSocketServer } from './lib/socket/server'

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || 'localhost'
const port = parseInt(process.env.PORT || '3000', 10)

async function main() {
  // Initialize Next.js app
  const app = next({ dev, hostname, port })
  const handle = app.getRequestHandler()

  await app.prepare()

  // Initialize Payload CMS
  const payload = await getPayload({ config })
  console.log('[Server] Payload CMS initialized')

  // Create HTTP server
  const httpServer = http.createServer((req, res) => {
    handle(req, res)
  })

  // Initialize Socket.IO with in-memory adapter (default)
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.SERVER_URL || `http://${hostname}:${port}`,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // In-memory adapter is the default, no need to specify
  })

  // Initialize socket event handlers
  initializeSocketServer(io, payload)

  // Start server
  httpServer.listen(port, () => {
    console.log(`[Server] Ready on http://${hostname}:${port}`)
    console.log(`[Server] Socket.IO initialized with in-memory adapter`)
  })
}

main().catch((err) => {
  console.error('[Server] Failed to start:', err)
  process.exit(1)
})
