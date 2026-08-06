'use client'

import { Loader2 } from 'lucide-react'

interface SavingViewProps {
  isAudioOnly?: boolean
}

/**
 * SavingView - Shown while recording is being uploaded/saved after call ends
 */
export function SavingView({ isAudioOnly }: SavingViewProps) {
  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center gap-4">
      <Loader2 className="w-12 h-12 animate-spin text-primary" />
      <p className="text-lg font-medium text-foreground">
        {isAudioOnly ? 'Сохранение аудио, подождите...' : 'Сохранение видео, подождите...'}
      </p>
      <p className="text-sm text-muted-foreground">
        Не закрывайте страницу
      </p>
    </div>
  )
}
