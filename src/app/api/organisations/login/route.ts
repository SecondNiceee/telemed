import { NextRequest, NextResponse } from 'next/server'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import {
  buildSetCookie,
  buildClearCookie,
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
    response.headers.append('Set-Cookie', buildClearCookie('payload-token'))

    return response
  } catch (err: any) {
    const message = err?.message || 'Invalid credentials'
    return NextResponse.json({ message }, { status: 401 })
  }
}
