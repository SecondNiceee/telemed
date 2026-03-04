import { NextResponse } from 'next/server'
import { buildClearCookie } from '@/lib/auth-cookies'

export async function POST() {
  const response = NextResponse.json({ message: 'Logged out successfully' })

  response.headers.append('Set-Cookie', buildClearCookie('payload-token'))

  return response
}
