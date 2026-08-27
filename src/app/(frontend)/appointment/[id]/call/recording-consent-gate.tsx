'use client'

import { AlertCircle, ShieldCheck, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RECORDING_CONSENT_TEXT } from '@/lib/recording-consent'

interface RecordingConsentGateProps {
  isSaving: boolean
  error: string | null
  onDecide: (granted: boolean) => void
}

/**
 * Экран согласия на запись - показывается пациенту до подключения к звонку.
 *
 * Экран именно блокирующий, а не уведомление сбоку: согласие должно быть
 * получено до начала записи, а не замечено во время. Пункты перечислены
 * дословно тем же текстом, который сервер сохранит в consentText.
 */
export function RecordingConsentGate({ isSaving, error, onDecide }: RecordingConsentGateProps) {
  const points = RECORDING_CONSENT_TEXT.split('\n')

  return (
    <section
      className="flex flex-1 items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recording-consent-title"
    >
      <div className="flex w-full max-w-xl flex-col gap-6 rounded-2xl border bg-card p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Video className="text-primary" aria-hidden="true" />
            <h2 id="recording-consent-title" className="text-balance text-2xl font-semibold">
              Консультация будет записана
            </h2>
          </div>
          <p className="text-pretty text-sm leading-6 text-muted-foreground">
            Прочитайте и выберите решение. Без вашего согласия запись не начнётся.
          </p>
        </div>

        <ul className="flex flex-col gap-3">
          {points.map((point) => (
            <li key={point} className="flex gap-3 text-pretty text-sm leading-6">
              <ShieldCheck className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
              <span>{point}</span>
            </li>
          ))}
        </ul>

        {error ? (
          <p className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm leading-6 text-destructive" role="alert">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </p>
        ) : null}

        {/*
          Отказ - равноправная кнопка, а не мелкая ссылка: консультация
          состоится в любом случае, и выбор не должен выглядеть навязанным.
        */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button className="flex-1" disabled={isSaving} onClick={() => onDecide(true)}>
            Согласен на запись
          </Button>
          <Button variant="outline" className="flex-1" disabled={isSaving} onClick={() => onDecide(false)}>
            Без записи
          </Button>
        </div>
      </div>
    </section>
  )
}
