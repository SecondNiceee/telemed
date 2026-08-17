import { type NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

type ForgotPasswordBody = {
  email?: string
}

/**
 * Восстановление пароля.
 *
 * Нативный `/api/users/forgot-password` Payload всегда отвечает 200, чтобы не
 * раскрывать существование аккаунта. Из-за этого пользователь мог отправить
 * запрос на незарегистрированную почту и бесконечно ждать письмо. Здесь мы
 * сначала проверяем наличие пользователя и отвечаем понятной ошибкой.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ForgotPasswordBody
    const email = body.email?.trim().toLowerCase()

    if (!email) {
      return NextResponse.json({ message: 'Укажите email' }, { status: 400 })
    }

    const payload = await getPayload({ config })

    const existing = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      limit: 1,
      overrideAccess: true,
    })

    if (!existing.docs[0]) {
      return NextResponse.json({ message: 'Данная почта не зарегистрирована.' }, { status: 404 })
    }

    // Письмо со ссылкой отправляет сам Payload через forgotPassword.generateEmailHTML
    await payload.forgotPassword({
      collection: 'users',
      data: { email },
    })

    return NextResponse.json(
      { message: 'Письмо для восстановления пароля отправлено.' },
      { status: 200 },
    )
  } catch (error: unknown) {
    console.error('[forgot-password] Error:', error)
    return NextResponse.json(
      { message: 'Не удалось отправить письмо для восстановления пароля' },
      { status: 500 },
    )
  }
}
