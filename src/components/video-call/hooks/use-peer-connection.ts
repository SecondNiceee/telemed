'use client'

import { useCallback, useRef, useState } from 'react'
import type Peer from 'peerjs'
import type { MediaConnection } from 'peerjs'
import { PEER_SERVER_CONFIG, ICE_SERVERS, CALL_TIMEOUTS } from '@/lib/video-call/config'
import type { UsePeerConnectionOptions, UsePeerConnectionReturn } from '@/lib/video-call/types'

export function usePeerConnection(options: UsePeerConnectionOptions): UsePeerConnectionReturn {
  const { peerId, onIncomingCall, onCallConnected, onCallEnded, onError } = options

  const [peer, setPeer] = useState<Peer | null>(null)
  const [currentCall, setCurrentCall] = useState<MediaConnection | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const peerRef = useRef<Peer | null>(null)
  const callRef = useRef<MediaConnection | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const setupCallHandlers = useCallback(
    (call: MediaConnection, isOutgoing: boolean) => {
      call.on('stream', (remoteStream: MediaStream) => {
        console.log('[usePeerConnection] Received remote stream')
        setIsConnecting(false)
        onCallConnected?.(remoteStream)
      })

      call.on('close', () => {
        console.log('[usePeerConnection] Call closed')
        setCurrentCall(null)
        callRef.current = null
        onCallEnded?.()
      })

      call.on('error', (err: Error) => {
        console.error('[usePeerConnection] Call error:', err)
        setError(err)
        onError?.(err)
      })

      // ICE connection state monitoring
      const peerConnection = (call as MediaConnection & { peerConnection?: RTCPeerConnection }).peerConnection
      if (peerConnection) {
        peerConnection.oniceconnectionstatechange = () => {
          const state = peerConnection.iceConnectionState
          console.log('[usePeerConnection] ICE connection state:', state)

          if (state === 'disconnected' || state === 'failed') {
            if (reconnectAttemptsRef.current < CALL_TIMEOUTS.MAX_RECONNECT_ATTEMPTS) {
              reconnectAttemptsRef.current++
              console.log(`[usePeerConnection] Attempting reconnect ${reconnectAttemptsRef.current}/${CALL_TIMEOUTS.MAX_RECONNECT_ATTEMPTS}`)
              // ICE restart would be handled here if supported
            } else {
              call.close()
              onCallEnded?.()
            }
          } else if (state === 'connected') {
            reconnectAttemptsRef.current = 0
          }
        }
      }
    },
    [onCallConnected, onCallEnded, onError]
  )

  const initPeer = useCallback(async (): Promise<Peer> => {
    // Clean up existing peer if any
    if (peerRef.current) {
      peerRef.current.destroy()
    }

    return new Promise((resolve, reject) => {
      import('peerjs').then(({ default: PeerJS }) => {
        const newPeer = new PeerJS(peerId, {
          host: PEER_SERVER_CONFIG.host,
          port: PEER_SERVER_CONFIG.port,
          path: PEER_SERVER_CONFIG.path,
          secure: PEER_SERVER_CONFIG.secure,
          debug: PEER_SERVER_CONFIG.debug,
          config: {
            iceServers: [...ICE_SERVERS],
          },
        })

        newPeer.on('open', (id: string) => {
          console.log('[usePeerConnection] Peer connected with ID:', id)
          setPeer(newPeer)
          peerRef.current = newPeer
          setError(null)
          resolve(newPeer)
        })

        newPeer.on('call', (incomingCall: MediaConnection) => {
          console.log('[usePeerConnection] Incoming call from:', incomingCall.peer)
          setCurrentCall(incomingCall)
          callRef.current = incomingCall
          onIncomingCall?.(incomingCall, incomingCall.peer)
        })

        newPeer.on('error', (err: Error) => {
          console.error('[usePeerConnection] Peer error:', err)
          setError(err)
          onError?.(err)
          
          // Handle disconnection - attempt reconnect
          if (err.message.includes('disconnected') || err.message.includes('Lost connection')) {
            if (reconnectAttemptsRef.current < CALL_TIMEOUTS.MAX_RECONNECT_ATTEMPTS) {
              reconnectTimeoutRef.current = setTimeout(() => {
                reconnectAttemptsRef.current++
                initPeer().catch(console.error)
              }, CALL_TIMEOUTS.RECONNECT_INTERVAL)
            }
          }
          
          reject(err)
        })

        newPeer.on('disconnected', () => {
          console.log('[usePeerConnection] Peer disconnected, attempting reconnect...')
          if (!newPeer.destroyed) {
            newPeer.reconnect()
          }
        })
      }).catch(reject)
    })
  }, [peerId, onIncomingCall, onError])

  const makeCall = useCallback(
    async (remotePeerId: string, localStream: MediaStream): Promise<MediaConnection> => {
      if (!peerRef.current) {
        throw new Error('Peer not initialized')
      }

      console.log('[usePeerConnection] Making call to:', remotePeerId)
      setIsConnecting(true)

      const call = peerRef.current.call(remotePeerId, localStream)
      setCurrentCall(call)
      callRef.current = call
      setupCallHandlers(call, true)

      return call
    },
    [setupCallHandlers]
  )

  const answerCall = useCallback(
    (call: MediaConnection, localStream: MediaStream) => {
      console.log('[usePeerConnection] Answering call')
      setIsConnecting(true)
      call.answer(localStream)
      setupCallHandlers(call, false)
    },
    [setupCallHandlers]
  )

  const endCall = useCallback(() => {
    console.log('[usePeerConnection] Ending call')
    if (callRef.current) {
      callRef.current.close()
      setCurrentCall(null)
      callRef.current = null
    }
  }, [])

  const cleanup = useCallback(() => {
    console.log('[usePeerConnection] Cleaning up')
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (callRef.current) {
      callRef.current.close()
      callRef.current = null
    }

    if (peerRef.current) {
      peerRef.current.destroy()
      peerRef.current = null
    }

    setPeer(null)
    setCurrentCall(null)
    setIsConnecting(false)
    setError(null)
    reconnectAttemptsRef.current = 0
  }, [])

  return {
    peer,
    currentCall,
    isConnecting,
    error,
    initPeer,
    makeCall,
    answerCall,
    endCall,
    cleanup,
  }
}
