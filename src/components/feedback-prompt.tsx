'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FeedbackDialog } from '@/components/feedback-dialog'
import { FeedbacksApi } from '@/lib/api/feedbacks'
import type { ApiAppointment, ApiDoctor } from '@/lib/api/types'

interface FeedbackPromptProps {
  appointments: ApiAppointment[]
  userId: number
}

interface PendingFeedback {
  appointmentId: number
  doctorId: number
  doctorName: string
}

export function FeedbackPrompt({ appointments, userId }: FeedbackPromptProps) {
  const [pendingFeedbacks, setPendingFeedbacks] = useState<PendingFeedback[]>([])
  const [currentFeedback, setCurrentFeedback] = useState<PendingFeedback | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkPendingFeedbacks = async () => {
      setIsLoading(true)
      const completedAppointments = appointments.filter(a => a.status === 'completed')
      
      const pending: PendingFeedback[] = []
      
      for (const appointment of completedAppointments) {
        try {
          const hasFeedback = await FeedbacksApi.hasFeedback(appointment.id)
          if (!hasFeedback) {
            const doctor = appointment.doctor as ApiDoctor
            pending.push({
              appointmentId: appointment.id,
              doctorId: typeof appointment.doctor === 'number' ? appointment.doctor : doctor.id,
              doctorName: appointment.doctorName || doctor?.name || 'Врач',
            })
          }
        } catch {
          // Skip if error checking feedback
        }
      }
      
      setPendingFeedbacks(pending)
      setIsLoading(false)
    }

    checkPendingFeedbacks()
  }, [appointments])

  const handleDismiss = (appointmentId: number) => {
    setDismissedIds(prev => new Set([...prev, appointmentId]))
  }

  const handleFeedbackSuccess = () => {
    if (currentFeedback) {
      setPendingFeedbacks(prev => 
        prev.filter(f => f.appointmentId !== currentFeedback.appointmentId)
      )
      setCurrentFeedback(null)
    }
  }

  const visibleFeedbacks = pendingFeedbacks.filter(f => !dismissedIds.has(f.appointmentId))

  if (isLoading || visibleFeedbacks.length === 0) {
    return null
  }

  // Show only the most recent pending feedback
  const feedbackToShow = visibleFeedbacks[0]

  return (
    <>
      <div className="relative mb-6 overflow-hidden rounded-2xl bg-card shadow-[0_0_0_1px_oklch(0_0_0_/_0.07),0_10px_28px_-18px_oklch(0.2079_0.0399_265.8_/_0.18)]">
        {/* Градиентная черта бренда: фиолетовый → бирюзовый */}
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-[3px]"
          style={{
            background: "linear-gradient(to right, var(--primary), var(--teal) 70%, transparent)",
          }}
        />

        <div className="flex flex-col gap-4 px-5 pb-5 pt-6 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              Оценка консультации
            </p>
            <p className="mt-1.5 text-pretty text-[15px] font-semibold leading-snug text-foreground">
              Как прошла консультация с врачом {feedbackToShow.doctorName}?
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              Ваш отзыв поможет другим пациентам выбрать специалиста.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              className="rounded-full px-5"
              onClick={() => {
                setCurrentFeedback(feedbackToShow)
                setIsDialogOpen(true)
              }}
            >
              Оставить отзыв
            </Button>
            <button
              type="button"
              className="shrink-0 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => handleDismiss(feedbackToShow.appointmentId)}
              aria-label="Скрыть"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {currentFeedback && (
        <FeedbackDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          doctorName={currentFeedback.doctorName}
          doctorId={currentFeedback.doctorId}
          appointmentId={currentFeedback.appointmentId}
          userId={userId}
          onSuccess={handleFeedbackSuccess}
        />
      )}
    </>
  )
}
