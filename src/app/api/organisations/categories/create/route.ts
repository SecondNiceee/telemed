import { NextRequest, NextResponse } from 'next/server'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import jwt from 'jsonwebtoken'
import { extractCookie } from '@/lib/auth-cookies'

const COOKIE_NAME = 'organisations-token'

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || ''
    const token = extractCookie(cookieHeader, COOKIE_NAME)

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized: No organisation token' },
        { status: 401 }
      )
    }

    const payload = await getPayload({ config: configPromise })

    let decoded: { id?: string | number; collection?: string; email?: string } | null = null
    try {
      decoded = jwt.verify(token, payload.secret) as { id?: string | number; collection?: string; email?: string }
    } catch (_ignore) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid token' },
        { status: 401 }
      )
    }

    if (!decoded?.id) {
      return NextResponse.json(
        { error: 'Unauthorized: No organisation ID' },
        { status: 401 }
      )
    }

    // Get request body
    const body = await req.json()
    const { name, slug, description, icon, iconImage } = body

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      )
    }

    console.log('[v0] Creating category via organisations API:', { organisationId: decoded.id, name, slug })

    // Create category - use overrideAccess because this is a special endpoint
    // The organisation is authenticated via their own token, not Payload's auth system
    const category = await payload.create({
      collection: 'doctor-categories',
      data: {
        name,
        slug,
        description: description || undefined,
        icon: icon || undefined,
        iconImage: iconImage || undefined,
      },
      overrideAccess: true,
      user: {
        id: decoded.id,
        collection: 'organisations',
        role: 'organisation',
        email: decoded.email,
      } as unknown as Record<string, unknown>,
    })


    return NextResponse.json(category)
  } catch (err: unknown) {
    console.error('[v0] Category creation error:', err)
    
    // Check for duplicate slug error
    const errMsg = err instanceof Error ? err.message : ''
    if (errMsg.includes('unique')) {
      return NextResponse.json(
        { error: 'Слаг должен быть уникальным' },
        { status: 400 }
      )
    }

    const message = errMsg || 'Failed to create category'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
