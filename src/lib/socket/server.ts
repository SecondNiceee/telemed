import type { Socket, Server as SocketIOServer } from 'socket.io'
import type { Payload } from 'payload'
import type { 
  AuthenticatedSocket, 
  SendMessagePayload, 
  JoinRoomPayload, 
  MarkReadPayload, 
  CallSignalPayload, 
  CallAnswerPayload, 
  CallRejectPayload, 
  CallEndPayload,
  CallParticipantLeavingPayload,
  CallParticipantRejoiningPayload,
  ConsultationStartPayload,
  ConsultationEndPayload,
  ChatBlockPayload,
  ChatUnblockPayload,
  ChangeConnectionTypePayload,
} from './types'
import { createAuthMiddleware } from './middleware/authMiddleware'
import { createJoinRoomHandler } from './handlers/joinRoomHandler'
import { createLeaveRoomHandler } from './handlers/leaveRoomHandler'
import { createSendMessageHandler } from './handlers/sendMessageHandler'
import { createMarkReadHandler } from './handlers/markReadHandler'
import { createTypingHandler } from './handlers/typingHandler'
import { createStopTypingHandler } from './handlers/stopTypingHandler'
import { createDisconnectHandler } from './handlers/disconnectHandler'
import { 
  createCallHandler, 
  createCallAnswerHandler, 
  createCallRejectHandler, 
  createCallEndHandler,
  createCallParticipantLeavingHandler,
  createCallParticipantRejoiningHandler,
  checkPendingCallsForSocket,
} from './handlers/callHandler'
import {
  createConsultationStartHandler,
  createConsultationEndHandler,
  createChatBlockHandler,
  createChatUnblockHandler,
  createChangeConnectionTypeHandler,
} from './handlers/consultationHandler'
import { rateLimitMap } from './config/rate-limit.config'

/**
 * [RATE LIMITING] Cleanup expired rate limit entries periodically
 */
function cleanupRateLimits() {
  const now = Date.now()
  for (const [socketId, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(socketId)
    }
  }
}

// Сокет io сервер запускается.
export function initializeSocketServer(io: SocketIOServer, payload: Payload) {
  // [RATE LIMITING] Cleanup expired entries every 30 seconds
  const cleanupInterval = setInterval(cleanupRateLimits, 30000)
  
  // Cleanup interval on server shutdown
  io.engine.on('close', () => {
    clearInterval(cleanupInterval)
  })

  // Проверка пользователя
  io.use(createAuthMiddleware())

  // Хэндлеры чата
  const joinRoomHandler = createJoinRoomHandler(payload) // Хэндлер входа в комнату
  const leaveRoomHandler = createLeaveRoomHandler() // Хэдлер выхода из комнаты
  const sendMessageHandler = createSendMessageHandler(io, payload) // Хэндлер  сообщения 
  const markReadHandler = createMarkReadHandler(io, payload) // Хэндлер прочитки
  const typingHandler = createTypingHandler() // Хэндлер печатания
  const stopTypingHandler = createStopTypingHandler() // Остановился печать

  // Хэндлеры звонка
  const callHandler = createCallHandler(io, payload)
  const callAnswerHandler = createCallAnswerHandler(io)
  const callRejectHandler = createCallRejectHandler(io)
  const callEndHandler = createCallEndHandler(io)
  const callParticipantLeavingHandler = createCallParticipantLeavingHandler(io)
  const callParticipantRejoiningHandler = createCallParticipantRejoiningHandler(io)
  const disconnectHandler = createDisconnectHandler(io)

  // Хэндлеры консультации
  const consultationStartHandler = createConsultationStartHandler(io, payload)
  const consultationEndHandler = createConsultationEndHandler(io, payload)
  const chatBlockHandler = createChatBlockHandler(io, payload)
  const chatUnblockHandler = createChatUnblockHandler(io, payload)
  const changeConnectionTypeHandler = createChangeConnectionTypeHandler(io, payload)

  io.on('connection', (socket: Socket) => {
    const authSocket = socket as AuthenticatedSocket
    console.log(`[Socket] Client connected: ${socket.id}, type: ${authSocket.data.senderType}, id: ${authSocket.data.senderId}`)
    
    // Check for pending incoming calls (handles page refresh during incoming call)
    checkPendingCallsForSocket(authSocket)

    // Когда чувак входит в чат (именно в какую-то конкретную консультацию)
    socket.on('join-room', (data: JoinRoomPayload) => joinRoomHandler(authSocket, data))

    // Теперь leave-room, чтобы выйти из комнатки
    socket.on('leave-room', (data: JoinRoomPayload) => leaveRoomHandler(authSocket, data))

    // Событие на отсылку сообщений
    socket.on('send-message', (data: SendMessagePayload) => sendMessageHandler(authSocket, data))

    // Событие прочитки сообщений
    socket.on('mark-read', (data: MarkReadPayload) => markReadHandler(authSocket, data))

    // Typing indicators
    socket.on('typing', (data: JoinRoomPayload) => typingHandler(authSocket, data))
    socket.on('stop-typing', (data: JoinRoomPayload) => stopTypingHandler(authSocket, data))

    // Video call signaling
    socket.on('call-initiate', (data: CallSignalPayload) => callHandler(authSocket, data))
    socket.on('call-answer', (data: CallAnswerPayload) => callAnswerHandler(authSocket, data))
    socket.on('call-reject', (data: CallRejectPayload) => callRejectHandler(authSocket, data))
    socket.on('call-end', (data: CallEndPayload) => callEndHandler(authSocket, data))
    
    // Participant reconnection events
    socket.on('call-participant-leaving', (data: CallParticipantLeavingPayload) => callParticipantLeavingHandler(authSocket, data))
    socket.on('call-participant-rejoining', (data: CallParticipantRejoiningPayload) => callParticipantRejoiningHandler(authSocket, data))

    // Consultation management events
    socket.on('consultation-start', (data: ConsultationStartPayload) => consultationStartHandler(authSocket, data))
    socket.on('consultation-end', (data: ConsultationEndPayload) => consultationEndHandler(authSocket, data))
    socket.on('chat-block', (data: ChatBlockPayload) => chatBlockHandler(authSocket, data))
    socket.on('chat-unblock', (data: ChatUnblockPayload) => chatUnblockHandler(authSocket, data))
    socket.on('change-connection-type', (data: ChangeConnectionTypePayload) => changeConnectionTypeHandler(authSocket, data))

    // Disconnect handler
    socket.on('disconnect', () => disconnectHandler(authSocket))
  })

  console.log('[Socket] Socket.IO server initialized')
}
