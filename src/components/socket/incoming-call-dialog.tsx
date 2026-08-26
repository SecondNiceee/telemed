'use client'

import { Phone, PhoneOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { IncomingCall } from './types'

interface IncomingCallDialogProps {
  incomingCall: IncomingCall | null
  onAccept: () => void
  onReject: () => void
}

export function IncomingCallDialog({ incomingCall, onAccept, onReject }: IncomingCallDialogProps) {
  return (
    /*
      Входящий звонок закрывается ТОЛЬКО кнопками «Принять» / «Отклонить»:
      случайный клик по затемнению или Esc не должны отменять звонок.
      onOpenChange намеренно пустой - состоянием управляет только код ниже.
    */
    <Dialog open={Boolean(incomingCall)}>
      <DialogContent
        showCloseButton={false}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Входящий {incomingCall?.isAudioOnly ? 'аудиозвонок' : 'видеозвонок'}</DialogTitle>
          <DialogDescription>{incomingCall?.callerName || 'Участник консультации'} приглашает вас в защищённую комнату.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onReject}><PhoneOff data-icon="inline-start" />Отклонить</Button>
          <Button onClick={onAccept}><Phone data-icon="inline-start" />Принять</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
