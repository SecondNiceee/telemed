'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FeedbacksApi } from '@/lib/api/feedbacks'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface FeedbackDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  doctorName: string
  doctorId: number
  appointmentId: number
  userId: number
  onSuccess?: () => void
}

export function FeedbackDialog({
  open,
  onOpenChange,
  doctorName,
  doctorId,
  appointmentId,
  userId,
  onSuccess,
}: FeedbackDialogProps) {
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [text, setText] = useState('')
  /**
   * Отзыв виден всем на странице врача, а имя рядом с ним раскрывает факт
   * обращения за медпомощью. Поэтому пациент явно выбирает, публиковать ли имя.
   */
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Пожалуйста, поставьте оценку')
      return
    }

    setIsSubmitting(true)
    try {
      await FeedbacksApi.create({
        appointment: appointmentId,
        doctor: doctorId,
        user: userId,
        rating,
        text: text.trim() || undefined,
        isAnonymous,
      })
      toast.success('Отзыв успешно отправлен')
      onOpenChange(false)
      onSuccess?.()
      // Reset form
      setRating(0)
      setText('')
      setIsAnonymous(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось отправить отзыв'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const displayRating = hoveredRating || rating

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Оставить отзыв</DialogTitle>
          <DialogDescription>
            Поделитесь впечатлениями о консультации с врачом {doctorName}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          {/* Star rating */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Ваша оценка</span>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className="p-1 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  disabled={isSubmitting}
                >
                  <Star
                    className={cn(
                      'w-8 h-8 transition-colors',
                      star <= displayRating
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-muted-foreground/30'
                    )}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <span className="text-sm text-muted-foreground">
                {rating === 1 && 'Плохо'}
                {rating === 2 && 'Не очень'}
                {rating === 3 && 'Нормально'}
                {rating === 4 && 'Хорошо'}
                {rating === 5 && 'Отлично'}
              </span>
            )}
          </div>

          {/* Text area */}
          <div className="flex flex-col gap-2">
            <label htmlFor="feedback-text" className="text-sm font-medium text-muted-foreground">
              Ваш отзыв (необязательно)
            </label>
            <textarea
              id="feedback-text"
              className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              placeholder="Расскажите о вашем опыте консультации..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={isSubmitting}
              maxLength={1000}
            />
            <span className="text-xs text-muted-foreground text-right">
              {text.length}/1000
            </span>
          </div>

          {/* Предупреждение о публикации и выбор анонимности */}
          <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-3">
            <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
              Отзыв и оценка будут опубликованы на странице врача и видны всем посетителям сайта.
              Не указывайте в тексте диагнозы и другие сведения о здоровье.
            </p>
            <label className="flex cursor-pointer items-start gap-2 text-sm leading-5">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                disabled={isSubmitting}
                className="mt-0.5 size-4 shrink-0 accent-primary"
              />
              <span className="text-pretty">
                Опубликовать анонимно
                <span className="block text-xs text-muted-foreground">
                  {isAnonymous
                    ? 'Вместо имени будет указано «Пациент».'
                    : 'Рядом с отзывом будет показано ваше имя и первая буква фамилии.'}
                </span>
              </span>
            </label>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || rating === 0}
          >
            {isSubmitting ? 'Отправка...' : 'Отправить отзыв'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
