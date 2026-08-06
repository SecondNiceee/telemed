'use client'

import { Video, MessageSquare, Loader2, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ConsultationDialogsProps } from '../types'

const connectionTypeLabels: Record<string, string> = {
  chat: 'Чат',
  audio: 'Аудио',
  video: 'Видео',
}

export function ConsultationDialogs({
  showCompleteDialog,
  showConsultationTypeDialog,
  isCompleting,
  connectionType,
  onCompleteDialogChange,
  onConsultationTypeDialogChange,
  onComplete,
  onStartVideoConsultation,
  onStartAudioConsultation,
  onStartChatConsultation,
}: ConsultationDialogsProps) {
  return (
    <>
      {/* Complete confirmation dialog */}
      <AlertDialog open={showCompleteDialog} onOpenChange={onCompleteDialogChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Завершить консультацию?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCompleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction 
              onClick={onComplete}
              disabled={isCompleting}
              className="bg-primary"
            >
              {isCompleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Завершение...
                </>
              ) : (
                'Завершить'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Consultation type selection dialog */}
      <Dialog open={showConsultationTypeDialog} onOpenChange={onConsultationTypeDialogChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Начать консультацию</DialogTitle>
            <DialogDescription>
              Выберите способ проведения консультации
            </DialogDescription>
          </DialogHeader>
          {connectionType && (
            <p className="text-sm text-green-600 font-medium">
              У пациента стоит предпочтительный способ связи: {connectionTypeLabels[connectionType] || connectionType}
            </p>
          )}
          <div className="grid grid-cols-3 gap-4 py-4">
            <Button
              variant="outline"
              className="h-auto py-6 flex flex-col items-center gap-3 hover:bg-primary/5 hover:border-primary"
              onClick={onStartVideoConsultation}
            >
              <Video className="w-10 h-10 text-primary" />
              <div className="text-center">
                <div className="font-semibold text-sm">Видео</div>
                <div className="text-xs text-muted-foreground">Видеозвонок</div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-6 flex flex-col items-center gap-3 hover:bg-primary/5 hover:border-primary"
              onClick={onStartAudioConsultation}
            >
              <Phone className="w-10 h-10 text-primary" />
              <div className="text-center">
                <div className="font-semibold text-sm">Аудио</div>
                <div className="text-xs text-muted-foreground">Голосовой звонок</div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-6 flex flex-col items-center gap-3 hover:bg-primary/5 hover:border-primary"
              onClick={onStartChatConsultation}
            >
              <MessageSquare className="w-10 h-10 text-primary" />
              <div className="text-center">
                <div className="font-semibold text-sm">Чат</div>
                <div className="text-xs text-muted-foreground">Текстовый чат</div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
