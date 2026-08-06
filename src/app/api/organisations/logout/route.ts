import { NextResponse } from 'next/server'
import { buildClearCookie } from '@/lib/auth-cookies'

const COOKIE_NAME = 'organisations-token'

export async function POST() {
  const response = NextResponse.json({ message: 'Logged out successfully' })

  response.headers.append('Set-Cookie', buildClearCookie(COOKIE_NAME))
  response.headers.append('Set-Cookie', buildClearCookie('payload-token'))

  return response
}
