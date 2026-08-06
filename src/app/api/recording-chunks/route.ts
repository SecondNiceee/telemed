import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import fs from 'fs/promises'
import path from 'path'
import { getPayload } from 'payload'
import config from '@payload-config'
import jwt from 'jsonwebtoken'

interface DecodedToken {
  id: number
  email: string
  collection: string
}

// Directory to store temporary chunks
const CHUNKS_DIR = '/tmp/recording-chunks'

// Ensure chunks directory exists
async function ensureChunksDir() {
  try {
    await fs.mkdir(CHUNKS_DIR, { recursive: true })
  } catch {
    // Directory exists
  }
}

// Get session ID for a recording (appointmentId + doctorId)
function getSessionId(appointmentId: number, doctorId: number): string {
  return `${appointmentId}_${doctorId}`
}

/**
 * POST /api/recording-chunks
 * Receives a chunk of video recording and stores it temporarily
 */
export async function POST(request: NextRequest) {
  console.log('[RecordingChunks] POST - Receiving chunk')
  
  try {
    // Check doctor authentication
    const cookieStore = await cookies()
    const doctorToken = cookieStore.get('doctors-token')?.value
    
    if (!doctorToken) {
      console.log('[RecordingChunks] No doctor token found')
      return NextResponse.json({ error: 'Unauthorized - no token' }, { status: 401 })
    }

    // Get payload instance to use its secret (same as used when signing tokens)
    const payload = await getPayload({ config })
    const secret = payload.secret
    
    if (!secret) {
      console.log('[RecordingChunks] No payload secret')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    let decoded: DecodedToken
    try {
      decoded = jwt.verify(doctorToken, secret) as DecodedToken
      console.log('[RecordingChunks] Token decoded:', { id: decoded.id, collection: decoded.collection })
    } catch (err) {
      console.log('[RecordingChunks] Invalid doctor token:', err)
      return NextResponse.json({ error: 'Unauthorized - invalid token' }, { status: 401 })
    }

    if (decoded.collection !== 'doctors') {
      console.log('[RecordingChunks] Not a doctor token, collection:', decoded.collection)
      return NextResponse.json({ error: 'Unauthorized - not a doctor' }, { status: 401 })
    }

    const doctorIdFromToken = decoded.id

    // Parse form data
    const formData = await request.formData()
    const chunk = formData.get('chunk') as Blob
    const appointmentId = parseInt(formData.get('appointmentId') as string)
    const doctorId = parseInt(formData.get('doctorId') as string)
    const chunkIndex = parseInt(formData.get('chunkIndex') as string)
    const isLast = formData.get('isLast') === 'true'
    const mimeType = formData.get('mimeType') as string || 'video/webm'

    console.log('[RecordingChunks] Chunk data:', {
      appointmentId,
      doctorId,
      chunkIndex,
      chunkSize: chunk?.size,
      isLast,
      mimeType,
    })

    if (!chunk || !appointmentId || !doctorId || chunkIndex === undefined) {
      console.log('[RecordingChunks] Missing required fields')
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify doctor owns this recording
    if (doctorIdFromToken !== doctorId) {
      console.log('[RecordingChunks] Doctor ID mismatch:', doctorIdFromToken, '!=', doctorId)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await ensureChunksDir()

    const sessionId = getSessionId(appointmentId, doctorId)
    const chunkPath = path.join(CHUNKS_DIR, `${sessionId}_${chunkIndex}.webm`)
    const metaPath = path.join(CHUNKS_DIR, `${sessionId}_meta.json`)

    // Save chunk to file
    const buffer = Buffer.from(await chunk.arrayBuffer())
    await fs.writeFile(chunkPath, buffer)

    // Update metadata
    let meta = { 
      appointmentId, 
      doctorId, 
      chunks: [] as number[], 
      mimeType,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    
    try {
      const existingMeta = await fs.readFile(metaPath, 'utf-8')
      meta = { ...meta, ...JSON.parse(existingMeta) }
    } catch {
      // First chunk
    }
    
    if (!meta.chunks.includes(chunkIndex)) {
      meta.chunks.push(chunkIndex)
      meta.chunks.sort((a, b) => a - b)
    }
    meta.updatedAt = new Date().toISOString()
    
    await fs.writeFile(metaPath, JSON.stringify(meta))

    console.log('[RecordingChunks] Chunk saved:', {
      sessionId,
      chunkIndex,
      totalChunks: meta.chunks.length,
      isLast,
    })

    return NextResponse.json({ 
      success: true, 
      sessionId,
      chunkIndex,
      totalChunks: meta.chunks.length,
    })

  } catch (error) {
    console.error('[RecordingChunks] Error:', error)
    return NextResponse.json(
      { error: 'Failed to save chunk' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/recording-chunks?appointmentId=X&doctorId=Y
 * Returns metadata about stored chunks for a session
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const appointmentId = parseInt(searchParams.get('appointmentId') || '')
  const doctorId = parseInt(searchParams.get('doctorId') || '')

  if (!appointmentId || !doctorId) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  const sessionId = getSessionId(appointmentId, doctorId)
  const metaPath = path.join(CHUNKS_DIR, `${sessionId}_meta.json`)

  try {
    const meta = await fs.readFile(metaPath, 'utf-8')
    return NextResponse.json(JSON.parse(meta))
  } catch {
    return NextResponse.json({ chunks: [] })
  }
}
