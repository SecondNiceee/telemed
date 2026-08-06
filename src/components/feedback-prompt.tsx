'use client'

import { useState, useEffect } from 'react'
import { Star, X } from 'lucide-react'
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
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Star className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              Вы недавно прошли консультацию с врачом {feedbackToShow.doctorName}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Поделитесь своим мнением о консультации
            </p>
            <Button
              size="sm"
              className="mt-3"
              onClick={() => {
                setCurrentFeedback(feedbackToShow)
                setIsDialogOpen(true)
              }}
            >
              <Star className="w-4 h-4 mr-1.5" />
              Оставить отзыв
            </Button>
          </div>
          <button
            className="flex-shrink-0 p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            onClick={() => handleDismiss(feedbackToShow.appointmentId)}
            aria-label="Скрыть"
          >
            <X className="w-4 h-4" />
          </button>
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
