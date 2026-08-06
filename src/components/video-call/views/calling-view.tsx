'use client'

import { Phone, X, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { CallingViewProps } from '@/lib/video-call/types'

export function CallingView({ callee, onCancel }: CallingViewProps) {
  const initials = callee.odooPartnerName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-background p-8">
      {/* Bouncing phone icon */}
      <div className="relative mb-8">
        <Avatar className="h-28 w-28 border-4 border-muted shadow-lg">
          <AvatarImage src={callee.avatar} alt={callee.odooPartnerName} />
          <AvatarFallback className="bg-muted text-2xl font-semibold text-muted-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 animate-bounce rounded-full bg-primary p-2">
          <Phone className="h-5 w-5 text-primary-foreground" />
        </div>
      </div>

      {/* Callee info */}
      <h2 className="mb-2 text-2xl font-semibold text-foreground">
        {callee.odooPartnerName}
      </h2>
      <p className="mb-8 animate-pulse text-muted-foreground">Вызов...</p>

      {/* Cancel button */}
      <Button
        variant="destructive"
        size="lg"
        className="h-16 w-16 rounded-full"
        onClick={onCancel}
      >
        <X className="h-7 w-7" />
      </Button>
    </div>
  )
}
