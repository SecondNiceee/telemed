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
  showCancelDialog,
  isCompleting,
  isCancelling,
  cancellationReason,
  customCancellationReason,
  connectionType,
  onCompleteDialogChange,
  onConsultationTypeDialogChange,
  onCancelDialogChange,
  onCancellationReasonChange,
  onCustomCancellationReasonChange,
  onComplete,
  onCancel,
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

      <Dialog open={showCancelDialog} onOpenChange={onCancelDialogChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Укажите причину, почему не состоялась консультация</DialogTitle>
            <DialogDescription>
              Пациенту автоматически вернётся полная стоимость консультации на карту,
              а причину он получит по электронной почте.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            {['Технические проблемы', 'Клиент не отвечает/не берет звонок', 'Другая причина'].map((reason) => (
              <label key={reason} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 text-sm">
                <input
                  type="radio"
                  name="cancellation-reason"
                  value={reason}
                  checked={cancellationReason === reason}
                  onChange={() => onCancellationReasonChange(reason)}
                />
                {reason}
              </label>
            ))}
            {cancellationReason === 'Другая причина' && (
              <textarea
                value={customCancellationReason}
                onChange={(event) => onCustomCancellationReasonChange(event.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Опишите причину"
                className="resize-none rounded-lg border border-border bg-background p-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
              />
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onCancelDialogChange(false)} disabled={isCancelling}>Закрыть</Button>
            <Button variant="destructive" onClick={onCancel} disabled={isCancelling || !cancellationReason || (cancellationReason === 'Другая причина' && !customCancellationReason.trim())}>
              {isCancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Отменить консультацию'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
