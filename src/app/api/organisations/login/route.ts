import { NextRequest, NextResponse } from 'next/server'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import {
  buildSetCookie,
  signCollectionToken,
  TOKEN_EXPIRATION,
} from '@/lib/auth-cookies'

const COOKIE_NAME = 'organisations-token'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ message: 'Email and password are required' }, { status: 400 })
    }

    const payload = await getPayload({ config: configPromise })

    const result = await payload.login({
      collection: 'organisations',
      data: { email, password },
    })

    if (!result.user) {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 })
    }

    const token = signCollectionToken(
      {
        id: result.user.id,
        collection: 'organisations',
        email: result.user.email,
      },
      payload.secret,
    )

    const response = NextResponse.json({
      message: 'Auth Passed',
      token,
      user: result.user,
      exp: Math.floor(Date.now() / 1000) + TOKEN_EXPIRATION,
    })

    response.headers.append('Set-Cookie', buildSetCookie(COOKIE_NAME, token))

    return response
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid credentials'
    return NextResponse.json({ message }, { status: 401 })
  }
}
