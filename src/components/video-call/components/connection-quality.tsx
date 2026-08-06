'use client'

import { Signal, SignalHigh, SignalMedium, SignalLow, SignalZero } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ConnectionQualityProps, ConnectionQuality as QualityType } from '@/lib/video-call/types'

const qualityConfig: Record<
  QualityType,
  { icon: typeof Signal; color: string; label: string }
> = {
  excellent: {
    icon: SignalHigh,
    color: 'text-green-500',
    label: 'Отлично',
  },
  good: {
    icon: SignalHigh,
    color: 'text-green-400',
    label: 'Хорошо',
  },
  fair: {
    icon: SignalMedium,
    color: 'text-yellow-500',
    label: 'Удовлетворительно',
  },
  poor: {
    icon: SignalLow,
    color: 'text-destructive',
    label: 'Плохое',
  },
  unknown: {
    icon: SignalZero,
    color: 'text-muted-foreground',
    label: 'Неизвестно',
  },
}

export function ConnectionQualityIndicator({
  quality,
  showLabel = false,
  className,
}: ConnectionQualityProps) {
  const config = qualityConfig[quality]
  const Icon = config.icon

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-full bg-background/80 px-2 py-1 backdrop-blur-sm',
        className
      )}
    >
      <Icon className={cn('h-4 w-4', config.color)} />
      {showLabel && (
        <span className={cn('text-xs font-medium', config.color)}>
          {config.label}
        </span>
      )}
    </div>
  )
}
