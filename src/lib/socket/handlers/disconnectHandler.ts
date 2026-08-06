import type { Server as SocketIOServer } from 'socket.io'
import type { AuthenticatedSocket } from '../types'
import { rateLimitMap } from '../config/rate-limit.config'
import { getAllActiveCalls, removeActiveCall } from '../stores/activeCallsStore'

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
    
    // Check if this disconnecting socket is a caller with active calls
    // If caller disconnects and has NO other sockets, remove the active call
    const activeCalls = getAllActiveCalls()
    for (const call of activeCalls) {
      if (call.callerType === socket.data.senderType && call.callerId === socket.data.senderId) {
        // Check if caller has any other connected sockets
        let hasOtherSocket = false
        for (const [socketId, connectedSocket] of io.sockets.sockets) {
          if (socketId === socket.id) continue
          const authSocket = connectedSocket as AuthenticatedSocket
          if (authSocket.data.senderType === call.callerType && authSocket.data.senderId === call.callerId) {
            hasOtherSocket = true
            break
          }
        }
        
        // If no other sockets for the caller, remove the active call
        if (!hasOtherSocket) {
          console.log(`[Socket] Caller disconnected with no other sockets, removing active call for appointment ${call.appointmentId}`)
          removeActiveCall(call.appointmentId)
          
          // Notify the target that the call was cancelled
          const targetType = call.targetType
          for (const [, connectedSocket] of io.sockets.sockets) {
            const authSocket = connectedSocket as AuthenticatedSocket
            if (authSocket.data.senderType === targetType) {
              authSocket.emit('call-ended', {
                appointmentId: call.appointmentId,
                endedBy: call.callerType,
                reason: 'caller_disconnected',
              })
            }
          }
        }
      }
    }
    
    // [RATE LIMITING] Cleanup rate limit entry
    rateLimitMap.delete(socket.id)
    
    console.log(`[Socket] Client disconnected: ${socket.id}`)
  }
}
