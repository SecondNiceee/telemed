'use client'

import { useCallback, useEffect, useState } from 'react'
import type { RecordingConsentStatus } from '@/lib/recording-consent'

interface UseRecordingConsentOptions {
  appointmentId: number
  /** Решение принимает только пациент; врач статус лишь читает. */
  isPatient: boolean
  /** Значение с сервера на момент загрузки страницы. */
  initialStatus: RecordingConsentStatus
}

interface UseRecordingConsentResult {
  status: RecordingConsentStatus
  /** Идёт запрос решения - на это время кнопки блокируются. */
  isSaving: boolean
  /** Последняя ошибка сохранения, чтобы показать её пациенту. */
  error: string | null
  decide: (granted: boolean) => Promise<void>
}

/**
 * Решение пациента о записи консультации.
 *
 * Пациент отвечает сам, а врачу статус нужен по двум причинам: показать, ведётся
 * ли запись, и в клиентском режиме - разрешить браузеру писать. Врач открывает
 * страницу раньше, чем пациент отвечает, поэтому для него статус опрашивается,
 * пока остаётся 'pending'.
 */
export function useRecordingConsent({
  appointmentId,
  isPatient,
  initialStatus,
}: UseRecordingConsentOptions): UseRecordingConsentResult {
  const [status, setStatus] = useState<RecordingConsentStatus>(initialStatus)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const decide = useCallback(
    async (granted: boolean) => {
      setIsSaving(true)
      setError(null)
      try {
        const response = await fetch(`/api/appointments/${appointmentId}/recording-consent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ granted }),
        })
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { message?: string } | null
          throw new Error(body?.message ?? 'Не удалось сохранить решение')
        }
        const body = (await response.json()) as { status?: RecordingConsentStatus }
        // Ставим значение, вернувшееся с сервера: именно оно определяет, будет
        // ли запись. Локальная догадка тут разошлась бы с реальностью.
        setStatus(body.status ?? (granted ? 'granted' : 'declined'))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Не удалось сохранить решение')
      } finally {
        setIsSaving(false)
      }
    },
    [appointmentId],
  )

  // Опрос только для врача и только пока пациент не ответил. Как ответил -
  // опрос прекращается: дальше значение уже не меняется само.
  useEffect(() => {
    if (isPatient) return
    if (status !== 'pending') return

    let cancelled = false
    const poll = async () => {
      try {
        const response = await fetch(`/api/appointments/${appointmentId}/recording-consent`)
        if (!response.ok) return
        const body = (await response.json()) as { status?: RecordingConsentStatus }
        if (!cancelled && body.status && body.status !== 'pending') setStatus(body.status)
      } catch {
        // Молча ждём следующей попытки: отсутствие ответа не меняет решение.
      }
    }

    const timer = window.setInterval(poll, 5000)
    void poll()
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [appointmentId, isPatient, status])

  return { status, isSaving, error, decide }
}
