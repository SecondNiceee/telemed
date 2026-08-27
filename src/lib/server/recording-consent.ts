import 'server-only'

import type { Payload } from 'payload'
import { isRecordingAllowedByConsent, type RecordingConsentStatus } from '@/lib/recording-consent'

/**
 * Проверка согласия на стороне сервера - перед началом записи и перед её
 * сохранением.
 *
 * Почему проверок две (здесь и в контроллере записи). Контроллер спрашивает
 * разрешение до старта сегмента, то есть в норме файл вообще не создаётся. Но
 * решение пациента может измениться уже во время звонка, а сегмент к этому
 * моменту идёт. Поэтому finalize спрашивает снова: без согласия готовый файл
 * не попадёт ни в media, ни в call-recordings.
 */
export async function getRecordingConsentStatus(
  payload: Payload,
  appointmentId: number | string,
): Promise<RecordingConsentStatus> {
  try {
    const appointment = await payload.findByID({
      collection: 'appointments',
      id: appointmentId,
      depth: 0,
      overrideAccess: true,
    })
    const status = (appointment as { recordingConsent?: { status?: string | null } }).recordingConsent?.status
    if (status === 'granted' || status === 'declined' || status === 'pending') return status
    // Колонки ещё нет (миграция не применена) или значение пустое. Считаем,
    // что пациента не спрашивали: молчание запись не разрешает.
    return 'pending'
  } catch {
    // Консультация не найдена или база недоступна. Ошибка чтения не должна
    // превращаться в разрешение записывать.
    return 'pending'
  }
}

/** Разрешена ли запись этой консультации прямо сейчас. */
export async function isRecordingAllowed(
  payload: Payload,
  appointmentId: number | string,
): Promise<boolean> {
  return isRecordingAllowedByConsent(await getRecordingConsentStatus(payload, appointmentId))
}
