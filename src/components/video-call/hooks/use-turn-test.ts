'use client'

import { useCallback, useState } from 'react'
import { ICE_SERVERS, CALL_TIMEOUTS } from '@/lib/video-call/config'
import type { UseTurnTestReturn } from '@/lib/video-call/types'

export function useTurnTest(): UseTurnTestReturn {
  const [isTurnWorking, setIsTurnWorking] = useState<boolean | null>(null)
  const [isTestRunning, setIsTestRunning] = useState(false)

  const testTurn = useCallback(async (): Promise<boolean> => {
    setIsTestRunning(true)
    setIsTurnWorking(null)

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        console.log('[useTurnTest] TURN test timed out')
        setIsTurnWorking(false)
        setIsTestRunning(false)
        resolve(false)
      }, CALL_TIMEOUTS.TURN_TEST_TIMEOUT)

      try {
        const pc = new RTCPeerConnection({
          iceServers: [...ICE_SERVERS],
          iceCandidatePoolSize: 0,
        })

        let turnFound = false

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            const candidate = event.candidate.candidate
            // Check if we get a relay candidate (TURN)
            if (candidate.includes('relay') || candidate.includes('typ relay')) {
              console.log('[useTurnTest] TURN server working, got relay candidate')
              turnFound = true
              clearTimeout(timeoutId)
              pc.close()
              setIsTurnWorking(true)
              setIsTestRunning(false)
              resolve(true)
            }
          }
        }

        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === 'complete') {
            if (!turnFound) {
              console.log('[useTurnTest] ICE gathering complete, no TURN relay found')
              clearTimeout(timeoutId)
              pc.close()
              setIsTurnWorking(false)
              setIsTestRunning(false)
              resolve(false)
            }
          }
        }

        // Create a data channel to trigger ICE gathering
        pc.createDataChannel('turn-test')
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .catch((err) => {
            console.error('[useTurnTest] Failed to create offer:', err)
            clearTimeout(timeoutId)
            pc.close()
            setIsTurnWorking(false)
            setIsTestRunning(false)
            resolve(false)
          })
      } catch (err) {
        console.error('[useTurnTest] Test failed:', err)
        clearTimeout(timeoutId)
        setIsTurnWorking(false)
        setIsTestRunning(false)
        resolve(false)
      }
    })
  }, [])

  return {
    isTurnWorking,
    isTestRunning,
    testTurn,
  }
}
