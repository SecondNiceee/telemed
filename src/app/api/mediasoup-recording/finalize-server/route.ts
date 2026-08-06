import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import fs from 'fs/promises'
import path from 'path'

// Must match the outputDir in src/lib/mediasoup/config.ts
const RECORDINGS_DIR = process.env.RECORDING_OUTPUT_DIR || '/tmp/mediasoup-recordings'

// Shared secret for server-to-server calls
const SERVER_SECRET = process.env.MEDIASOUP_SERVER_SECRET || 'mediasoup-internal-secret'

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

    // Verify server secret
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

    // Read the recording file
    const recordingBuffer = await fs.readFile(recordingPath)
    console.log('[MediaSoupRecording/FinalizeServer] Read recording buffer, size:', recordingBuffer.length)

    // Upload to Payload Media
    const filename = `consultation-${appointmentId}-${Date.now()}.webm`
    
    console.log('[MediaSoupRecording/FinalizeServer] Uploading to media via Payload...')
    
    const mediaDoc = await payload.create({
      collection: 'media',
      data: {
        alt: `Запись консультации #${appointmentId}`,
      },
      file: {
        data: recordingBuffer,
        mimetype: recordingType === 'audio' ? 'audio/webm' : 'video/webm',
        name: filename,
        size: recordingBuffer.length,
      },
    })
    
    const mediaId = mediaDoc.id
    console.log('[MediaSoupRecording/FinalizeServer] Media uploaded, ID:', mediaId)

    // Calculate duration if not provided
    const estimatedDuration = durationSeconds || Math.round(recordingBuffer.length / 50000)

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

    // Cleanup the temporary recording file
    try {
      await fs.unlink(recordingPath)
      console.log('[MediaSoupRecording/FinalizeServer] Cleaned up recording file')
      
      // Also try to clean up the SDP file if it exists
      const sdpPath = path.join(RECORDINGS_DIR, `${sessionId}.sdp`)
      await fs.unlink(sdpPath).catch(() => {})
    } catch (err) {
      console.warn('[MediaSoupRecording/FinalizeServer] Failed to cleanup files:', err)
    }

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
