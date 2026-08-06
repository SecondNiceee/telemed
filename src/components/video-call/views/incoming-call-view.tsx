'use client'

import { Phone, PhoneOff, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { IncomingCallViewProps } from '@/lib/video-call/types'

export function IncomingCallView({ caller, onAccept, onReject }: IncomingCallViewProps) {
  const initials = caller.odooPartnerName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-background p-8">
      {/* Pulsing ring animation */}
      <div className="relative mb-8">
        <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
        <div className="absolute inset-2 animate-ping rounded-full bg-primary/30 animation-delay-150" />
        <Avatar className="relative h-28 w-28 border-4 border-primary shadow-lg">
          <AvatarImage src={caller.avatar} alt={caller.odooPartnerName} />
          <AvatarFallback className="bg-primary/10 text-2xl font-semibold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
      </div>

      {/* Caller info */}
      <h2 className="mb-2 text-2xl font-semibold text-foreground">
        {caller.odooPartnerName}
      </h2>
      <p className="mb-8 text-muted-foreground">
        {caller.role === 'doctor' ? 'Врач' : 'Пациент'} звонит вам...
      </p>

      {/* Action buttons */}
      <div className="flex items-center gap-6">
        {/* Reject */}
        <Button
          variant="destructive"
          size="lg"
          className="h-16 w-16 rounded-full"
          onClick={onReject}
        >
          <PhoneOff className="h-7 w-7" />
        </Button>

        {/* Accept */}
        <Button
          size="lg"
          className="h-16 w-16 rounded-full bg-green-500 hover:bg-green-600"
          onClick={onAccept}
        >
          <Phone className="h-7 w-7" />
        </Button>
      </div>

      <style jsx>{`
        @keyframes ping {
          75%,
          100% {
            transform: scale(2);
            opacity: 0;
          }
        }
        .animation-delay-150 {
          animation-delay: 150ms;
        }
      `}</style>
    </div>
  )
}
