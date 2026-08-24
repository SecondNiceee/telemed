import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { finalizeRecordingSession } from '@/lib/server/recording-chunks'

interface DecodedToken {
  id: number
  email: string
  collection: string
}

/**
 * POST /api/recording-chunks/finalize
 *
 * Склеивает загруженные врачом чанки в один файл и создаёт call-recording.
 * Сама сборка живёт в src/lib/server/recording-chunks.ts, потому что тот же
 * код вызывает фоновый сборщик осиротевших сессий (если браузер врача умер
 * внезапно и этот запрос так и не пришёл).
 */
export async function POST(request: NextRequest) {
  console.log('[RecordingChunks/Finalize] Starting finalization')

  try {
    const payload = await getPayload({ config })

    const cookieStore = await cookies()
    const doctorToken = cookieStore.get('doctors-token')?.value

    if (!doctorToken) {
      console.log('[RecordingChunks/Finalize] No doctor token')
      return NextResponse.json({ error: 'Unauthorized - no token' }, { status: 401 })
    }

    const secret = payload.secret
    if (!secret) {
      console.log('[RecordingChunks/Finalize] No payload secret')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    let decoded: DecodedToken
    try {
      decoded = jwt.verify(doctorToken, secret) as DecodedToken
    } catch (err) {
      console.log('[RecordingChunks/Finalize] Invalid doctor token:', err)
      return NextResponse.json({ error: 'Unauthorized - invalid token' }, { status: 401 })
    }

    if (decoded.collection !== 'doctors') {
      console.log('[RecordingChunks/Finalize] Not a doctor token:', decoded.collection)
      return NextResponse.json({ error: 'Unauthorized - not a doctor' }, { status: 401 })
    }

    const body = await request.json()
    const { appointmentId, doctorId, durationSeconds, recordingType } = body

    if (!appointmentId || !doctorId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (decoded.id !== doctorId) {
      console.log('[RecordingChunks/Finalize] Doctor ID mismatch:', decoded.id, '!=', doctorId)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const result = await finalizeRecordingSession({
      appointmentId,
      doctorId,
      durationSeconds,
      recordingType,
    })

    if (result.status === 'no-chunks') {
      return NextResponse.json({ error: 'No chunks found' }, { status: 404 })
    }

    // Сессию уже забрал параллельный вызов (второй beacon или сборщик) -
    // для клиента это успех, дублировать запись не нужно.
    if (result.status === 'busy' || result.status === 'already-exists') {
      return NextResponse.json({ success: true, status: result.status })
    }

    return NextResponse.json({
      success: true,
      recordingId: result.recordingId,
      mediaId: result.mediaId,
    })
  } catch (error) {
    console.error('[RecordingChunks/Finalize] Error:', error)
    return NextResponse.json({ error: 'Failed to finalize recording' }, { status: 500 })
  }
}
