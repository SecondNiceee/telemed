import type { Server as SocketIOServer } from 'socket.io'
import type { AuthenticatedSocket } from '../types'
import { rateLimitMap } from '../config/rate-limit.config'
import { getActiveCall, getAllActiveCalls, removeActiveCall } from '../stores/activeCallsStore'

/**
 * Сколько ждём переподключения звонящего, прежде чем считать звонок отменённым.
 *
 * Звонящий врач ВСЕГДА на короткое время теряет сокет: инициировав звонок из
 * чата, он уходит на /appointment/[id]/call, страница чата размонтируется и
 * её сокет отключается, а сокет новой страницы подключается лишь через
 * несколько сотен миллисекунд. Если проверка «есть ли другие сокеты» попадает
 * в этот зазор, звонок отменяется сразу после создания - у пациента попап
 * успевает показаться и мгновенно исчезает. Отсюда и редкость бага: обычно
 * сокеты успевают перекрыться, но при медленном соединении или загруженном
 * CPU - нет.
 */
const CALLER_RECONNECT_GRACE_MS = 12_000

/** Таймеры отложенной отмены: ключ - `${appointmentId}:${callId}`. */
const pendingCancellations = new Map<string, ReturnType<typeof setTimeout>>()

/** Есть ли у участника хотя бы один подключённый сокет (кроме исключённого). */
function hasConnectedSocket(
  io: SocketIOServer,
  senderType: 'user' | 'doctor',
  senderId: number,
  excludeSocketId?: string,
): boolean {
  for (const [socketId, connectedSocket] of io.sockets.sockets) {
    if (socketId === excludeSocketId) continue
    const authSocket = connectedSocket as AuthenticatedSocket
    if (authSocket.data.senderType === senderType && authSocket.data.senderId === senderId) {
      return true
    }
  }
  return false
}

export function createDisconnectHandler(io: SocketIOServer) {
  return (socket: AuthenticatedSocket) => {
    // Send stop-typing to all rooms where user was typing
    for (const roomName of socket.data.typingInRooms) {
      socket.to(roomName).emit('user-stop-typing', {
        appointmentId: parseInt(roomName.replace('appointment:', ''), 10),
        senderType: socket.data.senderType,
        senderId: socket.data.senderId,
      })
    }

    // Если отключился звонящий - не отменяем звонок сразу, а даём ему время
    // на переподключение (переход между страницами, кратковременный обрыв).
    const activeCalls = getAllActiveCalls()
    for (const call of activeCalls) {
      if (call.callerType !== socket.data.senderType || call.callerId !== socket.data.senderId) {
        continue
      }

      // Другой сокет звонящего уже онлайн - отменять нечего.
      if (hasConnectedSocket(io, call.callerType, call.callerId, socket.id)) continue

      const cancellationKey = `${call.appointmentId}:${call.callId}`
      if (pendingCancellations.has(cancellationKey)) continue

      console.log(
        `[Socket] Caller went offline, waiting ${CALLER_RECONNECT_GRACE_MS}ms before cancelling call for appointment ${call.appointmentId}`,
      )

      const timer = setTimeout(() => {
        pendingCancellations.delete(cancellationKey)

        // Звонок уже приняли, отклонили или завершили - он исчез из стора.
        const stillActive = getActiveCall(call.appointmentId)
        if (!stillActive || stillActive.callId !== call.callId) return

        // Звонящий вернулся - звонок остаётся в силе.
        if (hasConnectedSocket(io, call.callerType, call.callerId)) {
          console.log(`[Socket] Caller reconnected, keeping call for appointment ${call.appointmentId}`)
          return
        }

        console.log(`[Socket] Caller did not return, cancelling call for appointment ${call.appointmentId}`)
        removeActiveCall(call.appointmentId, call.callId)

        // Уведомляем ТОЛЬКО адресата звонка. Раньше условие проверяло лишь
        // senderType, из-за чего call-ended улетал всем пациентам сразу.
        for (const [, connectedSocket] of io.sockets.sockets) {
          const authSocket = connectedSocket as AuthenticatedSocket
          if (authSocket.data.senderType !== call.targetType) continue
          if (call.targetId !== null && authSocket.data.senderId !== call.targetId) continue
          authSocket.emit('call-ended', {
            appointmentId: call.appointmentId,
            callId: call.callId,
            endedBy: call.callerType,
            reason: 'caller_disconnected',
          })
        }
      }, CALLER_RECONNECT_GRACE_MS)

      pendingCancellations.set(cancellationKey, timer)
    }

    // [RATE LIMITING] Cleanup rate limit entry
    rateLimitMap.delete(socket.id)

    console.log(`[Socket] Client disconnected: ${socket.id}`)
  }
}
