'use client'

import { Clock, Pause } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CALL_TIMER } from '@/lib/video-call/config'
import type { CallTimerProps } from '@/lib/video-call/types'

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function getTimerColor(seconds: number): string {
  if (seconds <= CALL_TIMER.CRITICAL_THRESHOLD_SECONDS) {
    return 'text-destructive'
  }
  if (seconds <= CALL_TIMER.WARNING_THRESHOLD_SECONDS) {
    return 'text-yellow-500'
  }
  return 'text-green-500'
}

export function CallTimer({ remainingSeconds, isPaused, className }: CallTimerProps) {
  const formattedTime = formatTime(remainingSeconds)
  const colorClass = getTimerColor(remainingSeconds)

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-full bg-background/80 px-3 py-1.5 backdrop-blur-sm',
        className
      )}
    >
      {isPaused ? (
        <Pause className={cn('h-4 w-4', colorClass)} />
      ) : (
        <Clock className={cn('h-4 w-4', colorClass)} />
      )}
      <span className={cn('font-mono text-sm font-medium', colorClass)}>
        {formattedTime}
      </span>
      {isPaused && (
        <span className="text-xs text-muted-foreground">(пауза)</span>
      )}
    </div>
  )
}
