import { NextRequest, NextResponse } from 'next/server'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { buildSetCookie, signCollectionToken, TOKEN_EXPIRATION } from '@/lib/auth-cookies'
import { hasAnyUser, stripAuthFields, USERS_COOKIE } from '@/lib/auth/adminSession'
import { normalizePhone, PHONE_STORAGE_REGEX } from '@/utils/phone'

/**
 * Создание первого администратора.
 *
 * Работает ровно один раз: как только в коллекции users появился хоть один
 * документ, роут отдаёт 409. Иначе это была бы дыра — любой мог бы создать себе
 * админа.
 */
export async function POST(req: NextRequest) {
  try {
    if (await hasAnyUser()) {
      return NextResponse.json(
        { message: 'Первичная настройка уже выполнена' },
        { status: 409 },
      )
    }

    const body = (await req.json()) as {
      name?: string
      email?: string
      phone?: string
      password?: string
    }

    const name = body.name?.trim()
    const email = body.email?.trim().toLowerCase()
    const password = body.password
    const phone = body.phone ? normalizePhone(body.phone) : null

    if (!name || !email || !password || !phone) {
      return NextResponse.json(
        { message: 'Заполните имя, email, телефон и пароль' },
        { status: 400 },
      )
    }
    if (!PHONE_STORAGE_REGEX.test(phone)) {
      return NextResponse.json({ message: 'Телефон в формате +7XXXXXXXXXX' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ message: 'Пароль минимум 8 символов' }, { status: 400 })
    }

    const payload = await getPayload({ config: configPromise })

    const user = await payload.create({
      collection: 'users',
      data: {
        name,
        email,
        phone,
        password,
        role: 'admin',
        // Первый админ создаётся вручную — письмо-подтверждение здесь только помешает.
        _verified: true,
      },
      overrideAccess: true,
    })

    const token = signCollectionToken(
      { id: user.id, collection: 'users', email: user.email, role: 'admin' },
      payload.secret,
    )

    const response = NextResponse.json({
      user: stripAuthFields(user as unknown as Record<string, unknown>),
      exp: Math.floor(Date.now() / 1000) + TOKEN_EXPIRATION,
    })
    response.headers.append('Set-Cookie', buildSetCookie(USERS_COOKIE, token))
    return response
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Не удалось создать администратора'
    return NextResponse.json({ message }, { status: 400 })
  }
}
