import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getRecordingConsentStatus } from '@/lib/server/recording-consent'
import { isRecordingAllowedByConsent } from '@/lib/recording-consent'

const SERVER_SECRET = process.env.MEDIASOUP_SERVER_SECRET

/**
 * Разрешено ли записывать эту консультацию - вопрос от mediasoup-сервера.
 *
 * Процесс mediasoup живёт отдельно от Next.js и к базе сам не обращается,
 * поэтому спрашивает через тот же серверный секрет, что и finalize-server.
 *
 * Секрет в теле запроса, а не в query: строка запроса попадает в логи nginx и
 * в access-логи целиком, а тело - нет.
 */
export async function POST(request: NextRequest) {
  try {
    if (!SERVER_SECRET || SERVER_SECRET.length < 32) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const body = await request.json().catch(() => null)
    const { appointmentId, serverSecret } = (body ?? {}) as {
      appointmentId?: number | string
      serverSecret?: string
    }

    if (serverSecret !== SERVER_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (appointmentId === undefined || appointmentId === null) {
      return NextResponse.json({ error: 'Missing appointmentId' }, { status: 400 })
    }

    const payload = await getPayload({ config })
    const status = await getRecordingConsentStatus(payload, appointmentId)

    return NextResponse.json({ allowed: isRecordingAllowedByConsent(status), status })
  } catch (error) {
    console.error('[RecordingConsent/Server] Ошибка проверки согласия:', error)
    // Ошибку контроллер трактует как запрет: не смогли подтвердить согласие -
    // не пишем.
    return NextResponse.json({ error: 'Failed to check consent' }, { status: 500 })
  }
}
