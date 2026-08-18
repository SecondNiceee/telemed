'use client'

import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useFeedbackStore } from '@/stores/feedback-store'
import { useUserStore } from '@/stores/user-store'
import { useUserAppointmentStore } from '@/stores/user-appointments-store'
import { FeedbackDialog } from '@/components/feedback-dialog'
import { ConsultationSelectDialog } from '@/components/consultation-select-dialog'
import type { ApiFeedback, ApiAppointment } from '@/lib/api/types'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface DoctorReviewsProps {
  doctorId: number
  doctorName: string
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function StarRating({ rating, className }: { rating: number; className?: string }) {
  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            'w-4 h-4',
            star <= rating
              ? 'fill-yellow-400 text-yellow-400'
              : 'text-muted-foreground/30'
          )}
        />
      ))}
    </div>
  )
}

/** Инициалы вместо аватара — отзывы приходят без фото. */
function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function ReviewCard({ feedback }: { feedback: ApiFeedback }) {
  const userName = typeof feedback.user === 'object' 
    ? feedback.user.name || feedback.user.email 
    : 'Пациент'
  
  return (
    <article className="flex gap-3 py-4">
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal/10 text-xs font-semibold leading-none text-teal ring-1 ring-teal/20"
      >
        {initialsOf(userName) || '—'}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex min-h-9 flex-wrap items-center gap-x-2 gap-y-0.5">
          <p className="truncate font-medium leading-none text-foreground">{userName}</p>
          <StarRating rating={feedback.rating} />
          <p className="text-xs leading-none text-muted-foreground">{formatDate(feedback.createdAt)}</p>
        </div>
        {feedback.text && (
          <p className="mt-1.5 border-l-2 border-teal/25 pl-3 text-sm leading-relaxed text-muted-foreground">
            {feedback.text}
          </p>
        )}
      </div>
    </article>
  )
}

export function DoctorReviews({ doctorId, doctorName }: DoctorReviewsProps) {
  const { user, fetchUser } = useUserStore()
  const { appointments, fetchAppointments } = useUserAppointmentStore()
  const { 
    feedbacksByDoctor, 
    loadingByDoctor, 
    loadFeedbacksByDoctor,
    userCompletedAppointmentsWithoutFeedback,
    loadingUserAppointments,
    loadUserCompletedAppointmentsWithoutFeedback,
  } = useFeedbackStore()

  const [showConsultationSelect, setShowConsultationSelect] = useState(false)
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<ApiAppointment | null>(null)

  const feedbacks = feedbacksByDoctor[doctorId] || []
  const isLoading = loadingByDoctor[doctorId]

  // Calculate average rating
  const averageRating = feedbacks.length > 0
    ? feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length
    : 0

  // Load feedbacks on mount
  useEffect(() => {
    loadFeedbacksByDoctor(doctorId)
  }, [doctorId, loadFeedbacksByDoctor])

  // Load user data when needed
  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  // Load appointments when user is available
  useEffect(() => {
    if (user) {
      fetchAppointments(user.id)
    }
  }, [user, fetchAppointments])

  const handleLeaveReviewClick = async () => {
    if (!user) {
      toast.error('Войдите в аккаунт, чтобы оставить отзыв')
      return
    }

    // Load appointments without feedback for this doctor
    await loadUserCompletedAppointmentsWithoutFeedback(doctorId, appointments)
    
    // Check results
    const availableAppointments = useFeedbackStore.getState().userCompletedAppointmentsWithoutFeedback
    
    if (availableAppointments.length === 0) {
      // No consultations available for review
      toast.info('У вас нет завершенных консультаций с этим врачом, на которые можно оставить отзыв')
      return
    }
    
    if (availableAppointments.length === 1) {
      // Only one consultation - go directly to feedback
      setSelectedAppointment(availableAppointments[0])
      setShowFeedbackDialog(true)
    } else {
      // Multiple consultations - show selection dialog
      setShowConsultationSelect(true)
    }
  }

  const handleConsultationSelect = (appointment: ApiAppointment) => {
    setSelectedAppointment(appointment)
    setShowConsultationSelect(false)
    setShowFeedbackDialog(true)
  }

  const handleFeedbackSuccess = () => {
    setShowFeedbackDialog(false)
    setSelectedAppointment(null)
    // Reload feedbacks to show new one (force refresh to bypass cache)
    loadFeedbacksByDoctor(doctorId, true)
  }

  // Check if user can leave a review
  // User must be logged in
  const canLeaveReview = !!user

  return (
    <Card className="mb-2 gap-0 overflow-hidden py-0">
      {/* Фирменная линия — как в шапке врача и баннере консультации */}
      <span
        aria-hidden="true"
        className="block h-1 bg-gradient-to-r from-teal via-primary to-transparent"
      />
      <CardContent className="px-4 pt-3 pb-4 sm:px-6 sm:pt-3 sm:pb-5">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex items-center gap-3">
            <h2 className="flex items-center gap-2.5 text-lg font-semibold text-foreground">
              <span
                aria-hidden="true"
                className="h-5 w-[3px] shrink-0 rounded-full bg-gradient-to-b from-teal to-primary"
              />
              Отзывы
            </h2>
            {feedbacks.length > 0 && (
              <span className="inline-flex items-center gap-2 rounded-full bg-teal/10 px-2.5 py-1">
                <span className="text-sm font-semibold leading-none tabular-nums text-teal">
                  {averageRating.toFixed(1)}
                </span>
                <StarRating rating={Math.round(averageRating)} />
                <span className="text-xs leading-none text-muted-foreground tabular-nums">
                  {feedbacks.length}
                </span>
              </span>
            )}
          </div>
          
          {canLeaveReview && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-teal/40 text-teal hover:bg-teal/10 hover:text-teal"
              onClick={handleLeaveReviewClick}
              disabled={loadingUserAppointments}
            >
              Оставить отзыв
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="py-6 text-center">
            <p className="text-sm text-muted-foreground">Загрузка отзывов...</p>
          </div>
        ) : feedbacks.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-teal/30 bg-teal/[0.04] px-4 py-5 text-center">
            <p className="text-sm text-muted-foreground">
              Пока нет отзывов — станьте первым, кт�� поделится опытом
            </p>
          </div>
        ) : (
          <div className="divide-y divide-teal/12">
            {feedbacks.map((feedback) => (
              <ReviewCard key={feedback.id} feedback={feedback} />
            ))}
          </div>
        )}
      </CardContent>

      {/* Consultation Selection Dialog */}
      <ConsultationSelectDialog
        open={showConsultationSelect}
        onOpenChange={setShowConsultationSelect}
        appointments={userCompletedAppointmentsWithoutFeedback}
        doctorName={doctorName}
        onSelect={handleConsultationSelect}
      />

      {/* Feedback Dialog */}
      {selectedAppointment && user && (
        <FeedbackDialog
          open={showFeedbackDialog}
          onOpenChange={(open) => {
            setShowFeedbackDialog(open)
            if (!open) setSelectedAppointment(null)
          }}
          doctorName={doctorName}
          doctorId={doctorId}
          appointmentId={selectedAppointment.id}
          userId={user.id}
          onSuccess={handleFeedbackSuccess}
        />
      )}
    </Card>
  )
}
