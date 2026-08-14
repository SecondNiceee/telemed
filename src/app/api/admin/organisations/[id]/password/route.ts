import { NextRequest, NextResponse } from 'next/server'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { getAdminFromCookieHeader } from '@/lib/auth/adminSession'
import { generatePassword } from '@/lib/generate-password'

/**
 * Сброс пароля организации.
 *
 * Payload хранит только хэш, поэтому «показать текущий пароль» невозможно —
 * вместо этого выдаём новый и показываем его один раз.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminFromCookieHeader(req.headers.get('cookie') || '')
  if (!admin) {
    return NextResponse.json({ message: 'Требуется вход администратора' }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = (await req.json().catch(() => ({}))) as { password?: string }

    const password = body.password?.trim() ? body.password.trim() : generatePassword()
    if (password.length < 8) {
      return NextResponse.json({ message: 'Пароль минимум 8 символов' }, { status: 400 })
    }

    const payload = await getPayload({ config: configPromise })

    const org = await payload.update({
      collection: 'organisations',
      id,
      data: { password },
      overrideAccess: true,
    })

    return NextResponse.json({
      organisation: { id: org.id, name: org.name, email: org.email },
      credentials: { email: org.email, password },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Не удалось сбросить пароль'
    return NextResponse.json({ message }, { status: 400 })
  }
}
