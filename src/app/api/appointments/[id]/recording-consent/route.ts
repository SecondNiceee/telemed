import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getUserFromCookies } from '@/lib/server/route-auth'
import { getParticipantSession } from '@/lib/server/participant-session'
import { RECORDING_CONSENT_TEXT } from '@/lib/recording-consent'

/** id из связи Payload: она приходит либо числом, либо развёрнутым документом. */
function relationshipId(value: unknown): string {
  if (typeof value === 'object' && value !== null && 'id' in value) return String(value.id)
  return String(value)
}

/**
 * Текущее решение по записи - читают оба участника консультации.
 *
 * Пациенту нужно, чтобы экран согласия не появился снова после перезагрузки
 * страницы. Врачу - чтобы узнать ответ: его страница открывается раньше, чем
 * пациент отвечает, и в клиентском режиме записи браузер врача обязан знать,
 * можно ли писать. Поэтому опрос идёт здесь, а не только в начальных пропсах.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const appointmentId = parseInt(id, 10)
    if (isNaN(appointmentId)) {
      return NextResponse.json({ message: 'Некорректный ID записи' }, { status: 400 })
    }

    const session = await getParticipantSession()
    if (!session) {
      return NextResponse.json({ message: 'Требуется авторизация' }, { status: 401 })
    }

    const payload = await getPayload({ config })
    const appointment = await payload.findByID({
      collection: 'appointments',
      id: appointmentId,
      overrideAccess: true,
      depth: 0,
    }).catch(() => null)

    if (!appointment) {
      return NextResponse.json({ message: 'Запись не найдена' }, { status: 404 })
    }

    // Статус отдаём только участникам этой консультации.
    const isPatient =
      session.collection === 'users' && relationshipId(appointment.user) === String(session.id)
    const isDoctor =
      session.collection === 'doctors' && relationshipId(appointment.doctor) === String(session.id)
    if (!isPatient && !isDoctor) {
      return NextResponse.json({ message: 'Нет доступа к этой консультации' }, { status: 403 })
    }

    const status = appointment.recordingConsent?.status ?? 'pending'
    return NextResponse.json({ status })
  } catch (err) {
    console.error('[RecordingConsent] Не удалось прочитать решение:', err)
    return NextResponse.json({ message: 'Не удалось прочитать решение' }, { status: 500 })
  }
}

/**
 * Решение пациента по записи консультации.
 *
 * Отвечать может только сам пациент этой консультации: запись - его данные о
 * здоровье, и согласие за него не даёт ни врач, ни организация. Поэтому здесь
 * не общий эндпоинт обновления консультации, а отдельный маршрут с одним
 * полем: даже при ошибке в клиентском коде через него нельзя поменять статус
 * приёма, цену или что-либо ещё.
 *
 * Текст берётся на сервере из общего модуля, а не из тела запроса. Иначе
 * клиент мог бы прислать любую формулировку и сохранить её как ту, с которой
 * пациент согласился.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const appointmentId = parseInt(id, 10)

    if (isNaN(appointmentId)) {
      return NextResponse.json({ message: 'Некорректный ID записи' }, { status: 400 })
    }

    const { user, error } = await getUserFromCookies()
    if (error) {
      return NextResponse.json({ message: error.message }, { status: error.status })
    }

    const body = await request.json().catch(() => null)
    const granted = (body as { granted?: unknown } | null)?.granted
    if (typeof granted !== 'boolean') {
      return NextResponse.json({ message: 'Ожидается поле granted (true/false)' }, { status: 400 })
    }

    const payload = await getPayload({ config })

    const appointment = await payload.findByID({
      collection: 'appointments',
      id: appointmentId,
      overrideAccess: true,
      depth: 0,
    }).catch(() => null)

    if (!appointment) {
      return NextResponse.json({ message: 'Запись не найдена' }, { status: 404 })
    }

    const appointmentUserId =
      typeof appointment.user === 'object' ? appointment.user.id : appointment.user

    if (appointmentUserId !== user.id) {
      return NextResponse.json({ message: 'Это не ваша запись' }, { status: 403 })
    }

    const status = granted ? 'granted' : 'declined'

    await payload.update({
      collection: 'appointments',
      id: appointmentId,
      overrideAccess: true,
      data: {
        recordingConsent: {
          status,
          decidedAt: new Date().toISOString(),
          // Сохраняем формулировку целиком: со временем текст изменится, а
          // подтверждать нужно ровно то, что человек видел на экране.
          consentText: RECORDING_CONSENT_TEXT,
        },
      },
    })

    console.log(`[RecordingConsent] Консультация ${appointmentId}: пациент ответил "${status}"`)

    return NextResponse.json({ status })
  } catch (err) {
    console.error('[RecordingConsent] Не удалось сохранить решение:', err)
    return NextResponse.json({ message: 'Не удалось сохранить решение' }, { status: 500 })
  }
}
