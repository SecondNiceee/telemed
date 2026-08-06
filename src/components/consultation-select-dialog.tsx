'use client'

import { Calendar, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ApiAppointment } from '@/lib/api/types'

interface ConsultationSelectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  appointments: ApiAppointment[]
  doctorName: string
  onSelect: (appointment: ApiAppointment) => void
}

function formatAppointmentDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function ConsultationSelectDialog({
  open,
  onOpenChange,
  appointments,
  doctorName,
  onSelect,
}: ConsultationSelectDialogProps) {
  if (appointments.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Нет доступных консультаций</DialogTitle>
            <DialogDescription>
              У вас нет завершенных консультаций с врачом {doctorName}, на которые можно оставить отзыв.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Закрыть
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Выберите консультацию</DialogTitle>
          <DialogDescription>
            Выберите консультацию с врачом {doctorName}, на которую хотите оставить отзыв
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 py-4 max-h-[300px] overflow-y-auto">
          {appointments.map((appointment) => (
            <button
              key={appointment.id}
              type="button"
              className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors text-left"
              onClick={() => onSelect(appointment)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-1">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  {formatAppointmentDate(appointment.date)}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  {appointment.time}
                  {appointment.specialty && (
                    <span className="text-xs bg-secondary px-2 py-0.5 rounded-full">
                      {appointment.specialty}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
