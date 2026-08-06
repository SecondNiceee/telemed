'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { UseCallTimerReturn } from '@/lib/video-call/types'

export function useCallTimer(initialMinutes: number = 0): UseCallTimerReturn {
  const [remainingSeconds, setRemainingSeconds] = useState(initialMinutes * 60)
  const [isPaused, setIsPaused] = useState(true)
  const [isExpired, setIsExpired] = useState(false)

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const remainingRef = useRef(remainingSeconds)

  // Sync ref with state
  useEffect(() => {
    remainingRef.current = remainingSeconds
  }, [remainingSeconds])

  // Timer tick logic
  useEffect(() => {
    if (isPaused || isExpired) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          setIsExpired(true)
          setIsPaused(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isPaused, isExpired])

  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }, [])

  const formattedTime = formatTime(remainingSeconds)

  const start = useCallback(() => {
    if (remainingSeconds > 0) {
      setIsPaused(false)
      setIsExpired(false)
    }
  }, [remainingSeconds])

  const pause = useCallback(() => {
    setIsPaused(true)
  }, [])

  const resume = useCallback(() => {
    if (remainingSeconds > 0 && !isExpired) {
      setIsPaused(false)
    }
  }, [remainingSeconds, isExpired])

  const reset = useCallback((durationMinutes: number) => {
    setRemainingSeconds(durationMinutes * 60)
    setIsPaused(true)
    setIsExpired(false)
  }, [])

  return {
    remainingSeconds,
    isPaused,
    isExpired,
    formattedTime,
    start,
    pause,
    resume,
    reset,
  }
}
