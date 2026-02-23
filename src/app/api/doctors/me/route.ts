import { NextRequest, NextResponse } from 'next/server'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import jwt from 'jsonwebtoken'
import { extractCookie } from '@/lib/auth-cookies'

const COOKIE_NAME = 'doctors-token'

export async function GET(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') || ''
  const token = extractCookie(cookieHeader, COOKIE_NAME)

  if (!token) {
    return NextResponse.json({ user: null })
  }

  const payload = await getPayload({ config: configPromise })

  let decoded: { id?: string | number; collection?: string; email?: string } | null = null
  try {
    decoded = jwt.verify(token, payload.secret) as { id?: string | number; collection?: string; email?: string }
  } catch {
    return NextResponse.json({ user: null })
  }

  if (!decoded?.id) {
    return NextResponse.json({ user: null })
  }

  try {
    const user = await payload.findByID({
      collection: 'doctors',
      id: decoded.id,
      depth: 1,
      overrideAccess: true,
    })

    if (!user) {
      return NextResponse.json({ user: null })
    }

    // Strip sensitive fields
    const { hash: _hash, salt: _salt, ...safeUser } = user as unknown as Record<string, unknown>
    return NextResponse.json({ user: safeUser })
  } catch {
    return NextResponse.json({ user: null })
  }
}
