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

      // User exists but not verified — update name and resend verification email
      const updatedUser = await payload.update({
        collection: 'users',
        id: candidate.id,
        data: { name: name ?? candidate.name ?? '' },
        overrideAccess: true,
        showHiddenFields: true,
      }) as typeof candidate

      const token = updatedUser._verificationToken ?? candidate._verificationToken

      if (token) {
        await sendVerificationEmail({
          payload,
          email,
          token,
          name: updatedUser.name ?? name,
        })
      }

      return NextResponse.json(
        { message: 'Письмо с подтверждением отправлено повторно.' },
        { status: 200 },
      )
    }

    // Create new user — Payload will send verification email automatically
    await payload.create({
      collection: 'users',
      data: {
        name: name ?? '',
        email,
        password,
        role: 'user',
      },
    })

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
