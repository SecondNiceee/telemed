import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromCookieHeader, hasAnyUser, stripAuthFields } from '@/lib/auth/adminSession'

/**
 * Состояние панели /admin: нужна ли первичная настройка и кто сейчас вошёл.
 */
export async function GET(req: NextRequest) {
  try {
    const needsSetup = !(await hasAnyUser())
    const admin = needsSetup ? null : await getAdminFromCookieHeader(req.headers.get('cookie') || '')

    return NextResponse.json({
      needsSetup,
      user: admin ? stripAuthFields(admin as unknown as Record<string, unknown>) : null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Не удалось получить состояние панели'
    return NextResponse.json({ message }, { status: 500 })
  }
}
