import 'dotenv/config'
import http from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { getPayload } from 'payload'
import config from '@payload-config'
import { initializeSocketServer } from './lib/socket/server'

// Socket.io runs on a SEPARATE port from Next.js
// This avoids the AsyncLocalStorage conflict with Next.js 15
const SOCKET_PORT = parseInt(process.env.SOCKET_PORT || '3001', 10)
const NEXT_URL = process.env.SERVER_URL || 'http://localhost:3000'
// Additional allowed origins for production (comma-separated)
const ALLOWED_ORIGINS = process.env.SOCKET_ALLOWED_ORIGINS 
  ? process.env.SOCKET_ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : []
const ALL_ORIGINS = [NEXT_URL, ...ALLOWED_ORIGINS]

async function main() {
  // Initialize Payload CMS (for database access)
  const payload = await getPayload({ config })
  console.log('[Socket Server] Payload CMS initialized')

  // Create standalone HTTP server for Socket.IO (no Next.js)
  const httpServer = http.createServer((req, res) => {
    // Simple health check endpoint
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }))
      return
    }
    
    // CORS preflight for socket.io
    if (req.method === 'OPTIONS') {
      const origin = req.headers.origin
      const allowedOrigin = origin && ALL_ORIGINS.includes(origin) ? origin : ALL_ORIGINS[0]
      res.writeHead(204, {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Credentials': 'true',
      })
      res.end()
      return
    }
    
    res.writeHead(404)
    res.end('Not found')
  })

  // Initialize Socket.IO with in-memory adapter
  const io = new SocketIOServer(httpServer, {
    path : process.env.SOCKET_PATH,
    cors: {
      origin: ALL_ORIGINS,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  })

  // Initialize socket event handlers
  initializeSocketServer(io, payload)

  // Start socket server
  httpServer.listen(SOCKET_PORT, () => {
    console.log(`[Socket Server] Ready on http://localhost:${SOCKET_PORT}`)
    console.log(`[Socket Server] Accepting connections from ${NEXT_URL}`)
    console.log(`[Socket Server] In-memory adapter (single process mode)`)
  })
}

main().catch((err) => {
  console.error('[Socket Server] Failed to start:', err)
  process.exit(1)
})
