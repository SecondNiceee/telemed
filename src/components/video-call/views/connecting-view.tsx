'use client'

import { Loader2 } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { ConnectingViewProps } from '@/lib/video-call/types'

export function ConnectingView({ participant }: ConnectingViewProps) {
  const initials = participant.odooPartnerName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-background p-8">
      {/* Avatar with spinner */}
      <div className="relative mb-8">
        <Avatar className="h-28 w-28 border-4 border-muted shadow-lg">
          <AvatarImage src={participant.avatar} alt={participant.odooPartnerName} />
          <AvatarFallback className="bg-muted text-2xl font-semibold text-muted-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-36 w-36 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
        </div>
      </div>

      {/* Connecting text */}
      <h2 className="mb-2 text-2xl font-semibold text-foreground">
        {participant.odooPartnerName}
      </h2>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Подключение...</span>
      </div>
    </div>
  )
}
