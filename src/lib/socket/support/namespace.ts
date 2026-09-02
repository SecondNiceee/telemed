import type { Payload } from 'payload'
import type { Server as SocketIOServer, Socket } from 'socket.io'
import { isTelegramConfigured } from '@/lib/telegram/client'
import { createResumeHandler, createSendMessageHandler, createStartHandler } from './handlers'
import {
  createOperatorJoinHandler,
  createOperatorOpenHandler,
  createOperatorReplyHandler,
  createOperatorStatusHandler,
} from './operator-handlers'
import { SUPPORT_NAMESPACE, cleanupSupportLimits } from './shared'

/**
 * Namespace чата поддержки.
 *
 * Почему отдельный namespace, а не общий сокет: `io.use(createAuthMiddleware())`
 * в `initializeSocketServer` отклоняет соединение без `payload-token` или
 * `doctors-token`. Посетители сайта анонимны по определению, и ослабить тот
 * middleware означало бы открыть анонимный доступ к чатам консультаций.
 *
 * В Socket.IO `io.use()` действует только на namespace по умолчанию, поэтому
 * `/support` со своим (гостевым) middleware ничего не ломает в существующей
 * защите — она остаётся ровно такой, какой была.
 */
export function initializeSupportNamespace(io: SocketIOServer, payload: Payload): void {
  const namespace = io.of(SUPPORT_NAMESPACE)

  const startHandler = createStartHandler(io, payload)
  const resumeHandler = createResumeHandler(payload)
  const sendMessageHandler = createSendMessageHandler(io, payload)

  const operatorJoinHandler = createOperatorJoinHandler(payload)
  const operatorOpenHandler = createOperatorOpenHandler(io, payload)
  const operatorReplyHandler = createOperatorReplyHandler(io, payload)
  const operatorStatusHandler = createOperatorStatusHandler(io, payload)

  const cleanupInterval = setInterval(cleanupSupportLimits, 30_000)
  io.engine.on('close', () => clearInterval(cleanupInterval))

  namespace.on('connection', (socket: Socket) => {
    // Гостевой доступ: личность не проверяем, потому что её нет. Доступ к
    // переписке даёт только знание publicId — непредсказуемых 32 байт.
    socket.on('support:start', (data, ack) => {
      void startHandler(socket, data ?? {}, ack)
    })

    socket.on('support:resume', (data, ack) => {
      void resumeHandler(socket, data ?? {}, ack)
    })

    socket.on('support:send', (data, ack) => {
      void sendMessageHandler(socket, data ?? {}, ack)
    })

    // Операторская половина того же namespace. Права проверяются внутри
    // каждого обработчика: middleware здесь гостевой и личность не знает.
    socket.on('support:operator:join', (ack) => {
      void operatorJoinHandler(socket, ack)
    })

    socket.on('support:operator:open', (data, ack) => {
      void operatorOpenHandler(socket, data ?? {}, ack)
    })

    socket.on('support:operator:reply', (data, ack) => {
      void operatorReplyHandler(socket, data ?? {}, ack)
    })

    socket.on('support:operator:status', (data, ack) => {
      void operatorStatusHandler(socket, data ?? {}, ack)
    })
  })

  console.log('[support] namespace /support готов')

  if (!isTelegramConfigured()) {
    // Это не ошибка: основной канал оператора — инбокс в /admin/inbox.
    // Telegram остался необязательным зеркалом (в РФ он ограничен ТСПУ).
    console.log('[support] Telegram не настроен — работает только инбокс в админке')
  }
}
