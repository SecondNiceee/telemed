'use client'

import { useEffect, useState } from 'react'
import { Star, MessageSquare } from 'lucide-react'
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

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
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

function ReviewCard({ feedback }: { feedback: ApiFeedback }) {
  const userName = typeof feedback.user === 'object' 
    ? feedback.user.name || feedback.user.email 
    : 'Пациент'
  
  return (
    <div className="py-4 border-b border-border last:border-b-0">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <p className="font-medium text-foreground">{userName}</p>
          <p className="text-xs text-muted-foreground">{formatDate(feedback.createdAt)}</p>
        </div>
        <StarRating rating={feedback.rating} />
      </div>
      {feedback.text && (
        <p className="text-sm text-muted-foreground leading-relaxed">{feedback.text}</p>
      )}
    </div>
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
      fetchAppointments()
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
    <Card className="mb-2">
      <CardContent className="px-6 py-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              Отзывы
            </h2>
            {feedbacks.length > 0 && (
              <div className="flex items-center gap-2">
                <StarRating rating={Math.round(averageRating)} />
                <span className="text-sm text-muted-foreground">
                  {averageRating.toFixed(1)} ({feedbacks.length})
                </span>
              </div>
            )}
          </div>
          
          {canLeaveReview && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-yellow-500 text-yellow-600 hover:bg-yellow-50 hover:text-yellow-700"
              onClick={handleLeaveReviewClick}
              disabled={loadingUserAppointments}
            >
              <Star className="w-4 h-4" />
              Оставить отзыв
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">Загрузка отзывов...</p>
          </div>
        ) : feedbacks.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">Пока нет отзывов</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
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
