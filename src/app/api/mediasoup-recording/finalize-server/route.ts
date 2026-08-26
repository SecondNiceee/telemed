import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import fs from 'fs/promises'
import { createReadStream, createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'
import path from 'path'
import { MEDIA_DIR, ensureMediaDir } from '@/lib/media-dir'
import { RECORDINGS_DIR } from '@/lib/recordings-dir'

/**
 * Переносит файл, не загружая его в память.
 *
 * rename мгновенен, но работает только внутри одной файловой системы. По
 * умолчанию каталоги записей и медиа лежат рядом (оба относительно cwd), так
 * что срабатывает быстрый путь. Но RECORDING_OUTPUT_DIR или MEDIA_DIR могут
 * указывать на разные тома - тогда ядро вернёт EXDEV, и мы копируем потоком:
 * данные идут через буфер фиксированного размера, а не целиком в RSS.
 */
async function moveFile(from: string, to: string): Promise<void> {
  ensureMediaDir()

  try {
    await fs.rename(from, to)
    return
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EXDEV') throw err
  }

  console.log('[MediaSoupRecording/FinalizeServer] Cross-device move, copying by stream')
  await pipeline(createReadStream(from), createWriteStream(to))
  await fs.unlink(from).catch(() => {})
}

// Shared secret for server-to-server calls
const SERVER_SECRET = process.env.MEDIASOUP_SERVER_SECRET

/**
 * POST /api/mediasoup-recording/finalize-server
 * 
 * Called by MediaSoup server when doctor disconnects and recording needs to be finalized.
 * This endpoint uses a server secret for authentication instead of doctor token.
 * 
 * Body:
 * - appointmentId: number (required) - parsed from roomId "appointment_123"
 * - doctorId: number (required) - determined from appointment
 * - sessionId: string (required) - the MediaSoup recording session ID
 * - durationSeconds: number (optional)
 * - recordingType: 'video' | 'audio' (optional, default: 'video')
 * - serverSecret: string (required) - for authentication
 */
export async function POST(request: NextRequest) {
  console.log('[MediaSoupRecording/FinalizeServer] Starting server-side finalization')
  
  try {
    const body = await request.json()
    const { appointmentId, sessionId, durationSeconds, recordingType = 'video', serverSecret } = body

    console.log('[MediaSoupRecording/FinalizeServer] Request data:', { appointmentId, sessionId, durationSeconds, recordingType })

    // Verify server secret. Never accept an absent secret on both sides.
    if (!SERVER_SECRET || SERVER_SECRET.length < 32) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }
    if (serverSecret !== SERVER_SECRET) {
      console.log('[MediaSoupRecording/FinalizeServer] Invalid server secret')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!appointmentId || !sessionId) {
      return NextResponse.json({ error: 'Missing required fields (appointmentId, sessionId)' }, { status: 400 })
    }

    // Get payload instance
    const payload = await getPayload({ config })

    // Fetch appointment to get doctorId
    let appointment
    try {
      appointment = await payload.findByID({
        collection: 'appointments',
        id: appointmentId,
      })
    } catch (err) {
      console.log('[MediaSoupRecording/FinalizeServer] Appointment not found:', appointmentId, err)
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    const doctorId = typeof appointment.doctor === 'object' ? appointment.doctor.id : appointment.doctor
    if (!doctorId) {
      console.log('[MediaSoupRecording/FinalizeServer] Doctor ID not found in appointment')
      return NextResponse.json({ error: 'Doctor not found in appointment' }, { status: 400 })
    }

    // Find the recording file
    const recordingPath = path.join(RECORDINGS_DIR, `${sessionId}.webm`)
    
    console.log('[MediaSoupRecording/FinalizeServer] Looking for recording at:', recordingPath)

    // Check if file exists
    let fileStats
    try {
      fileStats = await fs.stat(recordingPath)
      console.log('[MediaSoupRecording/FinalizeServer] Recording file found, size:', fileStats.size)
    } catch (err) {
      console.log('[MediaSoupRecording/FinalizeServer] Recording file not found:', recordingPath, err)
      return NextResponse.json({ error: 'Recording file not found' }, { status: 404 })
    }

    // Don't process empty files
    if (fileStats.size === 0) {
      console.log('[MediaSoupRecording/FinalizeServer] Recording file is empty')
      await fs.unlink(recordingPath).catch(() => {})
      return NextResponse.json({ error: 'Recording file is empty' }, { status: 400 })
    }

    // Файл НЕ читаем в память. Раньше здесь был fs.readFile целиком, и это
    // ломалось именно на длинных консультациях: при 1500k видео + 128k аудио
    // час записи - около 700 МБ, которые разом попадали в RSS процесса Next.js
    // и легко давали OOM. Payload при локальном хранилище всё равно записал бы
    // этот буфер обратно на диск, то есть память тратилась впустую.
    //
    // Вместо этого перемещаем готовый файл в каталог медиа сами (rename -
    // операция над метаданными, для файла любого размера мгновенная), а
    // документ создаём БЕЗ поля file. У коллекции media стоит
    // filesRequiredOnCreate: false, поэтому Payload принимает такой вызов и
    // сохраняет filename/mimeType/filesize как обычные поля.
    const filename = `consultation-${appointmentId}-${Date.now()}.webm`
    const mimeType = recordingType === 'audio' ? 'audio/webm' : 'video/webm'
    const targetPath = path.join(MEDIA_DIR, filename)

    console.log('[MediaSoupRecording/FinalizeServer] Moving recording into media dir:', targetPath)
    await moveFile(recordingPath, targetPath)

    let mediaId: number | string
    try {
      const mediaDoc = await payload.create({
        collection: 'media',
        data: {
          alt: `Запись консультации #${appointmentId}`,
          filename,
          mimeType,
          filesize: fileStats.size,
        },
      })
      mediaId = mediaDoc.id
    } catch (err) {
      // Документа нет - файл в каталоге медиа осиротеет, поэтому убираем его.
      await fs.unlink(targetPath).catch(() => {})
      throw err
    }

    console.log('[MediaSoupRecording/FinalizeServer] Media created, ID:', mediaId)

    // Real duration comes from the recording controller; fall back to a
    // rough size-based estimate only if it was not provided.
    const estimatedDuration =
      typeof durationSeconds === 'number' && durationSeconds > 0
        ? Math.round(durationSeconds)
        : Math.round(fileStats.size / 50000)

    // Create call-recording entry
    const recording = await payload.create({
      collection: 'call-recordings',
      data: {
        appointment: appointmentId,
        doctor: doctorId,
        video: mediaId,
        durationSeconds: estimatedDuration,
        recordedAt: new Date().toISOString(),
        recordingType: recordingType as 'video' | 'audio',
      },
    })

    console.log('[MediaSoupRecording/FinalizeServer] CallRecording created, ID:', recording.id)

    // Сам webm удалять не нужно: он уже перемещён в каталог медиа, а не
    // скопирован. Подчищаем только служебный SDP, если он остался.
    const sdpPath = path.join(RECORDINGS_DIR, `${sessionId}.sdp`)
    await fs.unlink(sdpPath).catch(() => {})

    return NextResponse.json({ 
      success: true, 
      recordingId: recording.id,
      mediaId,
    })

  } catch (error) {
    console.error('[MediaSoupRecording/FinalizeServer] Error:', error)
    return NextResponse.json(
      { error: 'Failed to finalize recording' },
      { status: 500 }
    )
  }
}
