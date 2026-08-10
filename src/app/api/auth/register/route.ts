import { type NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { normalizePhone } from '@/utils/phone'
import { getResendWaitMs, issueCodeForUser, RESEND_COOLDOWN_MS } from '@/utils/verificationCode'

type RegisterBody = {
  name?: string
  phone?: string
  email?: string
  password?: string
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RegisterBody
    const { name, phone: rawPhone, email, password } = body

    const phone = normalizePhone(rawPhone)

    if (!phone) {
      return NextResponse.json(
        { message: 'Укажите корректный номер телефона' },
        { status: 400 },
      )
    }

    if (!password) {
      return NextResponse.json({ message: 'Пароль обязателен' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json(
        { message: 'Пароль должен быть не менее 8 символов' },
        { status: 400 },
      )
    }

    const payload = await getPayload({ config })

    const existing = await payload.find({
      collection: 'users',
      where: { username: { equals: phone } },
      limit: 1,
      showHiddenFields: true,
      overrideAccess: true,
    })

    const candidate = existing.docs[0]

    if (candidate) {
      if (candidate.phoneVerified) {
        return NextResponse.json(
          { message: 'Пользователь с таким телефоном уже существует' },
          { status: 409 },
        )
      }

      // Регистрация не была завершена — обновляем данные и отправляем новый код
      const waitMs = getResendWaitMs(candidate.verificationCodeSentAt)
      if (waitMs > 0) {
        return NextResponse.json(
          {
            message: `Код уже отправлен. Повторить можно через ${Math.ceil(waitMs / 1000)} сек.`,
            retryAfter: Math.ceil(waitMs / 1000),
          },
          { status: 429 },
        )
      }

      await payload.update({
        collection: 'users',
        id: candidate.id,
        data: {
          name: name ?? candidate.name ?? '',
          ...(email ? { email } : {}),
          password,
        },
        overrideAccess: true,
      })

      await issueCodeForUser({ payload, userId: candidate.id, phone })

      return NextResponse.json(
        {
          message: 'Код подтверждения отправлен повторно.',
          phone,
          resendAfter: RESEND_COOLDOWN_MS / 1000,
        },
        { status: 200 },
      )
    }

    const created = await payload.create({
      collection: 'users',
      data: {
        username: phone,
        name: name ?? '',
        ...(email ? { email } : {}),
        password,
        role: 'user',
        phoneVerified: false,
      },
      overrideAccess: true,
    })

    await issueCodeForUser({ payload, userId: created.id, phone })

    return NextResponse.json(
      {
        message: 'Мы отправили код подтверждения по SMS.',
        phone,
        resendAfter: RESEND_COOLDOWN_MS / 1000,
      },
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
