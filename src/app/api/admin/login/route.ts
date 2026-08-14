import { NextRequest, NextResponse } from 'next/server'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { buildSetCookie, signCollectionToken, TOKEN_EXPIRATION } from '@/lib/auth-cookies'
import { stripAuthFields, USERS_COOKIE } from '@/lib/auth/adminSession'

/**
 * Вход в панель /admin. Пускаем только пользователей с role === 'admin':
 * обычный пользователь с валидным паролем не должен получить панель.
 */
export async function POST(req: NextRequest) {
  try {
    const { email, password } = (await req.json()) as { email?: string; password?: string }

    if (!email || !password) {
      return NextResponse.json({ message: 'Введите email и пароль' }, { status: 400 })
    }

    const payload = await getPayload({ config: configPromise })

    const result = await payload.login({
      collection: 'users',
      data: { email, password },
    })

    if (!result.user) {
      return NextResponse.json({ message: 'Неверный email или пароль' }, { status: 401 })
    }
    if (result.user.role !== 'admin') {
      return NextResponse.json({ message: 'Нет доступа к панели управления' }, { status: 403 })
    }

    const token = signCollectionToken(
      {
        id: result.user.id,
        collection: 'users',
        email: result.user.email,
        role: 'admin',
      },
      payload.secret,
    )

    const response = NextResponse.json({
      user: stripAuthFields(result.user as unknown as Record<string, unknown>),
      exp: Math.floor(Date.now() / 1000) + TOKEN_EXPIRATION,
    })
    response.headers.append('Set-Cookie', buildSetCookie(USERS_COOKIE, token))
    return response
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неверный email или пароль'
    return NextResponse.json({ message }, { status: 401 })
  }
}
