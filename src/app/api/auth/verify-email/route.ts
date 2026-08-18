import { type NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { buildSetCookie, signCollectionToken, TOKEN_EXPIRATION } from '@/lib/auth-cookies'

const COOKIE_NAME = 'payload-token'

type VerifyBody = {
  token?: string
}

/**
 * Подтверждение email + автоматический вход.
 *
 * Нативный эндпоинт Payload (`/api/users/verify/{token}`) только помечает
 * аккаунт как подтверждённый, но НЕ создаёт сессию. Из-за этого после перехода
 * по ссылке из письма пользователь оставался неавторизованным и в шапке всё ещё
 * висела кнопка «Войти».
 *
 * Здесь мы подтверждаем email и сразу выдаём cookie `payload-token` (как это
 * делают роуты входа врача/организации и сброса пароля), чтобы пользователь
 * попал на главную уже залогиненным.
 */
export async function POST(req: NextRequest) {
  try {
    const { token } = (await req.json()) as VerifyBody

    if (!token) {
      return NextResponse.json({ message: 'Токен не найден' }, { status: 400 })
    }

    const payload = await getPayload({ config })

    // Находим пользователя по токену подтверждения ДО верификации:
    // после успешного verifyEmail() Payload очищает _verificationToken.
    const existing = await payload.find({
      collection: 'users',
      where: { _verificationToken: { equals: token } },
      limit: 1,
      showHiddenFields: true,
      overrideAccess: true,
    })

    const candidate = existing.docs[0] as
      | ((typeof existing.docs)[0] & { _verified?: boolean })
      | undefined

    if (!candidate) {
      return NextResponse.json(
        { message: 'Ссылка недействительна или уже была использована.' },
        { status: 400 },
      )
    }

    // Подтверждаем email (идемпотентно для этого токена).
    await payload.verifyEmail({ collection: 'users', token })

    // Свежая копия пользователя для клиента.
    const user = await payload.findByID({
      collection: 'users',
      id: candidate.id,
      overrideAccess: true,
    })

    // Выдаём сессию: подписываем тем же секретом, которым Payload проверяет cookie.
    const authToken = signCollectionToken(
      {
        id: user.id,
        collection: 'users',
        email: user.email,
        role: (user as { role?: string }).role,
      },
      payload.secret,
    )

    const response = NextResponse.json({
      message: 'Email подтверждён',
      user,
      exp: Math.floor(Date.now() / 1000) + TOKEN_EXPIRATION,
    })

    response.headers.append('Set-Cookie', buildSetCookie(COOKIE_NAME, authToken))

    return response
  } catch (error: unknown) {
    console.error('[verify-email] Error:', error)
    const message = error instanceof Error ? error.message : 'Не удалось подтвердить email.'
    return NextResponse.json({ message }, { status: 400 })
  }
}
