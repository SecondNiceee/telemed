'use client'

import { useState, useRef, useCallback } from 'react'

const TYPING_TIMEOUT = 2000

export function useTyping(
  appointmentId: number,
  startTyping: (appointmentId: number) => void,
  stopTyping: (appointmentId: number) => void
) {
  const [isTyping, setIsTyping] = useState(false)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleTyping = useCallback(() => {
    if (!isTyping) {
      setIsTyping(true)
      startTyping(appointmentId)
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false)
      stopTyping(appointmentId)
    }, TYPING_TIMEOUT)
  }, [isTyping, appointmentId, startTyping, stopTyping])

  const resetTyping = useCallback(() => {
    setIsTyping(false)
    stopTyping(appointmentId)
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
  }, [appointmentId, stopTyping])

  return {
    isTyping,
    handleTyping,
    resetTyping,
  }
}
