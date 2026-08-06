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

const CHUNKS_DIR = '/tmp/recording-chunks'

function getSessionId(appointmentId: number, doctorId: number): string {
  return `${appointmentId}_${doctorId}`
}

/**
 * POST /api/recording-chunks/finalize
 * Combines all chunks into a single video file and creates the CallRecording entry
 */
export async function POST(request: NextRequest) {
  console.log('[RecordingChunks/Finalize] Starting finalization')
  
  try {
    // Get payload instance first to use its secret
    const payload = await getPayload({ config })
    
    // Check doctor authentication
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
      console.log('[RecordingChunks/Finalize] Token decoded:', { id: decoded.id, collection: decoded.collection })
    } catch (err) {
      console.log('[RecordingChunks/Finalize] Invalid doctor token:', err)
      return NextResponse.json({ error: 'Unauthorized - invalid token' }, { status: 401 })
    }

    if (decoded.collection !== 'doctors') {
      console.log('[RecordingChunks/Finalize] Not a doctor token, collection:', decoded.collection)
      return NextResponse.json({ error: 'Unauthorized - not a doctor' }, { status: 401 })
    }

    const doctorIdFromToken = decoded.id

    const body = await request.json()
    const { appointmentId, doctorId, durationSeconds, recordingType = 'video' } = body

    console.log('[RecordingChunks/Finalize] Request data:', { appointmentId, doctorId, durationSeconds, recordingType })

    if (!appointmentId || !doctorId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify doctor owns this recording
    if (doctorIdFromToken !== doctorId) {
      console.log('[RecordingChunks/Finalize] Doctor ID mismatch:', doctorIdFromToken, '!=', doctorId)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const sessionId = getSessionId(appointmentId, doctorId)
    const metaPath = path.join(CHUNKS_DIR, `${sessionId}_meta.json`)

    // Read metadata
    let meta: { chunks: number[]; mimeType: string; updatedAt?: string }
    try {
      const metaContent = await fs.readFile(metaPath, 'utf-8')
      meta = JSON.parse(metaContent)
      console.log('[RecordingChunks/Finalize] Meta file content:', meta)
    } catch (err) {
      console.log('[RecordingChunks/Finalize] No chunks found for session:', sessionId, 'error:', err)
      return NextResponse.json({ error: 'No chunks found' }, { status: 404 })
    }

    console.log('[RecordingChunks/Finalize] Found chunks:', meta.chunks.length, 'lastUpdated:', meta.updatedAt)

    if (meta.chunks.length === 0) {
      return NextResponse.json({ error: 'No chunks to finalize' }, { status: 400 })
    }

    // Read and combine all chunks
    const chunkBuffers: Buffer[] = []
    for (const chunkIndex of meta.chunks) {
      const chunkPath = path.join(CHUNKS_DIR, `${sessionId}_${chunkIndex}.webm`)
      try {
        const buffer = await fs.readFile(chunkPath)
        chunkBuffers.push(buffer)
        console.log('[RecordingChunks/Finalize] Read chunk:', chunkIndex, 'size:', buffer.length)
      } catch (err) {
        console.error('[RecordingChunks/Finalize] Failed to read chunk:', chunkIndex, err)
      }
    }

    if (chunkBuffers.length === 0) {
      return NextResponse.json({ error: 'Failed to read chunks' }, { status: 500 })
    }

    // Combine chunks
    const combinedBuffer = Buffer.concat(chunkBuffers)
    console.log('[RecordingChunks/Finalize] Combined buffer size:', combinedBuffer.length)

    // Upload directly via Payload API (bypasses nginx body size limit)
    const filename = `consultation-${appointmentId}-${Date.now()}.webm`
    
    console.log('[RecordingChunks/Finalize] Uploading to media via Payload...')
    
    const mediaDoc = await payload.create({
      collection: 'media',
      data: {
        alt: `Запись консультации #${appointmentId}`,
      },
      file: {
        data: combinedBuffer,
        mimetype: meta.mimeType || 'video/webm',
        name: filename,
        size: combinedBuffer.length,
      },
    })
    
    const mediaId = mediaDoc.id
    console.log('[RecordingChunks/Finalize] Media uploaded, ID:', mediaId)

    // Create call-recording entry
    const recording = await payload.create({
      collection: 'call-recordings',
      data: {
        appointment: appointmentId,
        doctor: doctorId,
        video: mediaId,
        durationSeconds: durationSeconds || Math.round(combinedBuffer.length / 50000), // Rough estimate if not provided
        recordedAt: new Date().toISOString(),
        recordingType: recordingType as 'video' | 'audio',
      },
    })

    console.log('[RecordingChunks/Finalize] Recording created, ID:', recording.id)

    // Cleanup chunks
    await cleanupSession(sessionId, meta.chunks)

    return NextResponse.json({ 
      success: true, 
      recordingId: recording.id,
      mediaId,
    })

  } catch (error) {
    console.error('[RecordingChunks/Finalize] Error:', error)
    return NextResponse.json(
      { error: 'Failed to finalize recording' },
      { status: 500 }
    )
  }
}

async function cleanupSession(sessionId: string, chunks: number[]) {
  console.log('[RecordingChunks/Finalize] Cleaning up session:', sessionId)
  
  try {
    // Delete chunk files
    for (const chunkIndex of chunks) {
      const chunkPath = path.join(CHUNKS_DIR, `${sessionId}_${chunkIndex}.webm`)
      try {
        await fs.unlink(chunkPath)
      } catch {
        // Ignore
      }
    }
    
    // Delete meta file
    const metaPath = path.join(CHUNKS_DIR, `${sessionId}_meta.json`)
    try {
      await fs.unlink(metaPath)
    } catch {
      // Ignore
    }
    
    console.log('[RecordingChunks/Finalize] Cleanup complete')
  } catch (error) {
    console.error('[RecordingChunks/Finalize] Cleanup error:', error)
  }
}
