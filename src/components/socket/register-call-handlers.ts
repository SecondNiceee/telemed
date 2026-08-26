import type { Socket } from 'socket.io-client'
import { playNotificationSound } from './notification-sound'
import { clearOutgoingCallStatus, setOutgoingCallStatus } from './outgoing-call-status'
import type { CallHandlerDeps } from './types'

/**
 * Сигнализация звонков: входящее приглашение, ответ, отклонение, завершение.
 */
export function registerCallHandlers(
  socket: Socket,
  { currentSenderTypeRef, setIncomingCall, remoteCallEndedCallbacksRef }: CallHandlerDeps,
) {
  // Video call signaling events
  socket.on('incoming-call', ({ appointmentId, callId, callerName, callerType, isAudioOnly }) => {
    if (callerType !== currentSenderTypeRef.current) {
      setIncomingCall({ appointmentId, callId, callerName, isAudioOnly: Boolean(isAudioOnly) })
      playNotificationSound()
    }
  })

  socket.on('call-answered', ({ callId }) => {
    setOutgoingCallStatus(callId, 'answered')
  })
  socket.on('call-rejected', ({ callId }) => {
    setIncomingCall((current) => current?.callId === callId ? null : current)
    setOutgoingCallStatus(callId, 'rejected')
  })

  socket.on('call-ended', async ({ appointmentId, callId }) => {
    console.log('[Socket] Call ended by remote, appointmentId:', appointmentId, 'callbacks count:', remoteCallEndedCallbacksRef.current.size)

    // IMPORTANT: Call all registered callbacks BEFORE updating the store
    // This allows VideoCallProvider to stop recording and save video before store resets data
    // We MUST await all callbacks to ensure recording is saved before store is cleared
    const callbackPromises: Promise<void>[] = []
    remoteCallEndedCallbacksRef.current.forEach(callback => {
      try {
        const result = callback(appointmentId)
        // If callback returns a promise, track it
        if (result instanceof Promise) {
          callbackPromises.push(result.catch(err => {
            console.error('[Socket] Error in async remoteCallEnded callback:', err)
          }))
        }
      } catch (err) {
        console.error('[Socket] Error in remoteCallEnded callback:', err)
      }
    })

    // Wait for all async callbacks to complete (e.g., recording finalization)
    if (callbackPromises.length > 0) {
      console.log('[Socket] Waiting for', callbackPromises.length, 'async callbacks to complete...')
      await Promise.all(callbackPromises)
      console.log('[Socket] All async callbacks completed')
    }

    // Гасим попап только если событие относится ИМЕННО к этому звонку.
    // Раньше `!callId` обнуляло любой входящий звонок, поэтому отголосок
    // call-end от предыдущего созвона мог погасить только что показанный
    // попап нового.
    setIncomingCall((current) => {
      if (!current) return current
      if (callId) return current.callId === callId ? null : current
      return current.appointmentId === appointmentId ? null : current
    })
    if (callId) clearOutgoingCallStatus(callId)
  })
}
