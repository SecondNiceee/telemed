import 'dotenv/config'
import { PeerServer } from 'peer'

const PEER_PORT = parseInt(process.env.PEER_PORT || '3002', 10)
// PeerJS клиент автоматически добавляет /peerjs к пути
// Nginx strip'ает /telemed-dev, поэтому запрос приходит как /peerjs
// Сервер должен слушать на / (root) чтобы принимать /peerjs
const PEER_PATH = '/'
const NEXT_URL = process.env.SERVER_URL || 'http://localhost:3000'
const ALLOWED_ORIGINS = process.env.SOCKET_ALLOWED_ORIGINS?.replace(/\/+$/, '') || 'http://localhost:3000'

// Create PeerJS server for WebRTC signaling
const peerServer = PeerServer({
  port: PEER_PORT,
  path: PEER_PATH,
  // Allow all origins for development
  corsOptions: {
    origin: '*', // Allow all origins in dev
    credentials: true,
  },
  // Увеличиваем интервалы для стабильности соединения
  alive_timeout: 60000, // 60 секунд до таймаута неактивного клиента
  // Ключ для проверки (опционально)
  key: 'peerjs',
  // Разрешить discovery для отладки
  allow_discovery: true,
})

console.log(`[PeerJS] CORS allowed origins: ${ALLOWED_ORIGINS}`)

peerServer.on('connection', (client) => {
  console.log(`[PeerJS] Client connected: ${client.getId()}`)
})

peerServer.on('disconnect', (client) => {
  console.log(`[PeerJS] Client disconnected: ${client.getId()}`)
})

peerServer.on('error', (error) => {
  console.error('[PeerJS] Server error:', error)
})

console.log(`[PeerJS] Server started on port ${PEER_PORT}`)
console.log(`[PeerJS] Path: ${PEER_PATH}`)
console.log(`[PeerJS] Accepting connections from: ${NEXT_URL}`)
