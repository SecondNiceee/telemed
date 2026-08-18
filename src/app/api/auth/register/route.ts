import { type NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sendVerificationEmail } from '@/utils/sendVerificationEmail'
import { normalizePhone } from '@/utils/phone'

type RegisterBody = {
  name?: string
  email?: string
  phone?: string
  password?: string
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RegisterBody
    const { name, email, phone: rawPhone, password } = body

    // Basic validation
    if (!email || !password) {
      return NextResponse.json({ message: 'Email и пароль обязательны' }, { status: 400 })
    }

    const phone = normalizePhone(rawPhone)

    if (!phone) {
      return NextResponse.json({ message: 'Укажите корректный номер телефона' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json(
        { message: 'Пароль должен быть не менее 8 символов' },
        { status: 400 },
      )
    }

    const payload = await getPayload({ config })

    // Телефон уникален (см. users.phone -> unique). Проверяем заранее и отдаём
    // понятную 409, а не сырую ошибку уникального индекса из БД (500).
    const existingByPhone = await payload.find({
      collection: 'users',
      where: { phone: { equals: phone } },
      limit: 1,
      showHiddenFields: true,
      overrideAccess: true,
    })

    const phoneOwner = existingByPhone.docs[0] as
      | ((typeof existingByPhone.docs)[0] & { _verified?: boolean })
      | undefined

    // Номер занят другим аккаунтом (по email). Свой же неподтверждённый аккаунт
    // с тем же email пропускаем — он до-регистрируется ниже.
    if (phoneOwner && phoneOwner.email !== email) {
      return NextResponse.json(
        { message: 'Пользователь с таким номером телефона уже существует' },
        { status: 409 },
      )
    }

    // Check if user already exists
    const existing = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      limit: 1,
      showHiddenFields: true,
      overrideAccess: true,
    })

    const candidate = existing.docs[0] as
      | ((typeof existing.docs)[0] & { _verified?: boolean; _verificationToken?: string })
      | undefined

    if (candidate) {
      if (candidate._verified) {
        return NextResponse.json(
          { message: 'Пользователь с таким email уже существует' },
          { status: 409 },
        )
      }

      // User exists but not verified — update data and resend verification email
      const updatedUser = (await payload.update({
        collection: 'users',
        id: candidate.id,
        data: {
          name: name ?? candidate.name ?? '',
          phone,
          password,
        },
        overrideAccess: true,
        showHiddenFields: true,
      })) as typeof candidate

      const token = updatedUser?._verificationToken ?? candidate._verificationToken

      if (token) {
        await sendVerificationEmail({
          payload,
          email,
          token,
          name: updatedUser?.name ?? name ?? undefined,
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
        phone,
        password,
        role: 'user',
      },
      overrideAccess: true,
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
