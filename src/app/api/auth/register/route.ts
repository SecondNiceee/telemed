import { type NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sendVerificationEmail } from '@/utils/sendVerificationEmail'

type RegisterBody = {
  name?: string
  email: string
  password: string
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RegisterBody
    const { name, email, password } = body

    // Basic validation
    if (!email || !password) {
      return NextResponse.json({ message: 'Email и пароль обязательны' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json(
        { message: 'Пароль должен быть не менее 8 символов' },
        { status: 400 },
      )
    }

    const payload = await getPayload({ config })

    // Check if user already exists
    const existing = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      limit: 1,
      showHiddenFields: true,
    })

    const candidate = existing.docs[0] as
      | (typeof existing.docs[0] & { _verified?: boolean; _verificationToken?: string })
      | undefined

    if (candidate) {
      if (candidate._verified) {
        return NextResponse.json(
          { message: 'Пользователь с таким email уже существует' },
          { status: 409 },
        )
      }

      // User exists but not verified — resend verification email
      if (candidate._verificationToken) {
        await sendVerificationEmail({
          payload,
          email: candidate.email,
          name: candidate.name ?? undefined,
          token: candidate._verificationToken,
        })
      }

      return NextResponse.json(
        { message: 'Подтвердите почту. Мы отправили письмо повторно.' },
        { status: 200 },
      )
    }

    // Create new user — Payload will generate _verificationToken automatically
    const newUser = await payload.create({
      collection: 'users',
      data: {
        name: name ?? '',
        email,
        password,
        role: 'user',
      },
      showHiddenFields: true,
    })

    const token = (newUser as typeof newUser & { _verificationToken?: string })._verificationToken

    if (token) {
      await sendVerificationEmail({
        payload,
        email: newUser.email,
        name: newUser.name ?? undefined,
        token,
      })
    }

    return NextResponse.json(
      { message: 'Подтвердите почту перед входом в аккаунт.' },
      { status: 201 },
    )
  } catch (error: unknown) {
    console.error('[register] Error:', error)
    return NextResponse.json(
      { message: 'Не удалось зарегистрировать пользователя' },
      { status: 500 },
    )
  }
}
