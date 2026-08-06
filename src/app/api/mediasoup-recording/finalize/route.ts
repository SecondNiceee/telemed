import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { cookies } from 'next/headers'
import fs from 'fs/promises'
import path from 'path'
import jwt from 'jsonwebtoken'

interface DecodedToken {
  id: number
  email: string
  collection: string
}

// Must match the outputDir in src/lib/mediasoup/config.ts
const RECORDINGS_DIR = process.env.RECORDING_OUTPUT_DIR || '/tmp/mediasoup-recordings'

/**
 * POST /api/mediasoup-recording/finalize
 * 
 * Called after MediaSoup server-side recording stops.
 * Takes the recording file from the filesystem, uploads it to Payload Media,
 * and creates a CallRecording entry.
 * 
 * Body:
 * - appointmentId: number (required)
 * - doctorId: number (required)
 * - sessionId: string (required) - the MediaSoup recording session ID
 * - durationSeconds: number (optional)
 * - recordingType: 'video' | 'audio' (optional, default: 'video')
 */
export async function POST(request: NextRequest) {
  console.log('[MediaSoupRecording/Finalize] Starting finalization')
  
  try {
    // Get payload instance first to use its secret
    const payload = await getPayload({ config })
    
    // Check doctor authentication
    const cookieStore = await cookies()
    const doctorToken = cookieStore.get('doctors-token')?.value
    
    if (!doctorToken) {
      console.log('[MediaSoupRecording/Finalize] No doctor token')
      return NextResponse.json({ error: 'Unauthorized - no token' }, { status: 401 })
    }

    const secret = payload.secret
    if (!secret) {
      console.log('[MediaSoupRecording/Finalize] No payload secret')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    let decoded: DecodedToken
    try {
      decoded = jwt.verify(doctorToken, secret) as DecodedToken
      console.log('[MediaSoupRecording/Finalize] Token decoded:', { id: decoded.id, collection: decoded.collection })
    } catch (err) {
      console.log('[MediaSoupRecording/Finalize] Invalid doctor token:', err)
      return NextResponse.json({ error: 'Unauthorized - invalid token' }, { status: 401 })
    }

    if (decoded.collection !== 'doctors') {
      console.log('[MediaSoupRecording/Finalize] Not a doctor token, collection:', decoded.collection)
      return NextResponse.json({ error: 'Unauthorized - not a doctor' }, { status: 401 })
    }

    const doctorIdFromToken = decoded.id

    const body = await request.json()
    const { appointmentId, doctorId, sessionId, durationSeconds, recordingType = 'video' } = body

    console.log('[MediaSoupRecording/Finalize] Request data:', { appointmentId, doctorId, sessionId, durationSeconds, recordingType })

    if (!appointmentId || !doctorId || !sessionId) {
      return NextResponse.json({ error: 'Missing required fields (appointmentId, doctorId, sessionId)' }, { status: 400 })
    }

    // Verify doctor owns this recording
    if (doctorIdFromToken !== doctorId) {
      console.log('[MediaSoupRecording/Finalize] Doctor ID mismatch:', doctorIdFromToken, '!=', doctorId)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Find the recording file
    // MediaSoup recorder saves files as {sessionId}.webm
    const recordingPath = path.join(RECORDINGS_DIR, `${sessionId}.webm`)
    
    console.log('[MediaSoupRecording/Finalize] Looking for recording at:', recordingPath)

    // Check if file exists
    let fileStats
    try {
      fileStats = await fs.stat(recordingPath)
      console.log('[MediaSoupRecording/Finalize] Recording file found, size:', fileStats.size)
    } catch (err) {
      console.log('[MediaSoupRecording/Finalize] Recording file not found:', recordingPath, err)
      return NextResponse.json({ error: 'Recording file not found' }, { status: 404 })
    }

    // Don't process empty files
    if (fileStats.size === 0) {
      console.log('[MediaSoupRecording/Finalize] Recording file is empty')
      await fs.unlink(recordingPath).catch(() => {})
      return NextResponse.json({ error: 'Recording file is empty' }, { status: 400 })
    }

    // Read the recording file
    const recordingBuffer = await fs.readFile(recordingPath)
    console.log('[MediaSoupRecording/Finalize] Read recording buffer, size:', recordingBuffer.length)

    // Upload to Payload Media
    const filename = `consultation-${appointmentId}-${Date.now()}.webm`
    
    console.log('[MediaSoupRecording/Finalize] Uploading to media via Payload...')
    
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
    console.log('[MediaSoupRecording/Finalize] Media uploaded, ID:', mediaId)

    // Calculate duration if not provided (rough estimate based on typical bitrate)
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

    console.log('[MediaSoupRecording/Finalize] CallRecording created, ID:', recording.id)

    // Cleanup the temporary recording file
    try {
      await fs.unlink(recordingPath)
      console.log('[MediaSoupRecording/Finalize] Cleaned up recording file')
      
      // Also try to clean up the SDP file if it exists
      const sdpPath = path.join(RECORDINGS_DIR, `${sessionId}.sdp`)
      await fs.unlink(sdpPath).catch(() => {})
    } catch (err) {
      console.warn('[MediaSoupRecording/Finalize] Failed to cleanup files:', err)
    }

    return NextResponse.json({ 
      success: true, 
      recordingId: recording.id,
      mediaId,
    })

  } catch (error) {
    console.error('[MediaSoupRecording/Finalize] Error:', error)
    return NextResponse.json(
      { error: 'Failed to finalize recording' },
      { status: 500 }
    )
  }
}
