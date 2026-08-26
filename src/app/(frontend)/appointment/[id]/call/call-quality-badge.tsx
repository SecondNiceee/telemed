'use client'

import { SignalHigh, SignalLow, SignalMedium } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { describeQualityLevel, type CallQualitySnapshot } from '@/lib/mediasoup/call-quality'
import { cn } from '@/lib/utils'

interface CallQualityBadgeProps {
  quality: CallQualitySnapshot
}

const levelStyles = {
  // Хорошая связь - это норма, поэтому она подаётся тихо и не спорит за
  // внимание со статусом звонка рядом.
  good: { icon: SignalHigh, className: 'text-muted-foreground' },
  fair: { icon: SignalMedium, className: 'text-foreground' },
  poor: { icon: SignalLow, className: 'border-destructive/30 bg-destructive/10 text-destructive' },
} as const

function formatMetric(value: number | null, unit: string, digits = 0): string {
  return value === null ? '—' : `${value.toFixed(digits)} ${unit}`
}

/**
 * Показывает участнику, в каком состоянии его связь с SFU.
 *
 * Индикатор осознанно отражает только собственный канал: показатели
 * собеседника сюда не приходят, и выдавать свои цифры за общие было бы
 * неверно - при односторонней проблеме это увело бы диагностику не туда.
 */
export function CallQualityBadge({ quality }: CallQualityBadgeProps) {
  if (quality.level === 'unknown') return null

  const { icon: Icon, className } = levelStyles[quality.level]

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn('flex items-center gap-2 rounded-full border border-transparent px-3 py-1 font-medium', className)}
          role="status"
          aria-live="polite"
        >
          <Icon className="size-4" aria-hidden="true" />
          {describeQualityLevel(quality.level)}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-1 text-xs">
          <dt>Задержка</dt>
          <dd className="text-right font-mono">{formatMetric(quality.rttMs, 'мс')}</dd>
          <dt>Потери исходящие</dt>
          <dd className="text-right font-mono">{formatMetric(quality.outboundLossPct, '%', 1)}</dd>
          <dt>Потери входящие</dt>
          <dd className="text-right font-mono">{formatMetric(quality.inboundLossPct, '%', 1)}</dd>
          <dt>Отдача</dt>
          <dd className="text-right font-mono">{formatMetric(quality.outboundKbps, 'кбит/с')}</dd>
          <dt>Приём</dt>
          <dd className="text-right font-mono">{formatMetric(quality.inboundKbps, 'кбит/с')}</dd>
          <dt>Джиттер</dt>
          <dd className="text-right font-mono">{formatMetric(quality.jitterMs, 'мс')}</dd>
        </dl>
      </TooltipContent>
    </Tooltip>
  )
}
