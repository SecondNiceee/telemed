import { type NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { normalizePhone } from '@/utils/phone'
import { MAX_ATTEMPTS } from '@/utils/verificationCode'

type VerifyBody = {
  phone?: string
  code?: string
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as VerifyBody
    const phone = normalizePhone(body.phone)
    const code = body.code?.trim()

    if (!phone || !code) {
      return NextResponse.json({ message: 'Укажите телефон и код' }, { status: 400 })
    }

    const payload = await getPayload({ config })

    const found = await payload.find({
      collection: 'users',
      where: { username: { equals: phone } },
      limit: 1,
      showHiddenFields: true,
      overrideAccess: true,
    })

    const user = found.docs[0]

    if (!user) {
      return NextResponse.json({ message: 'Пользователь не найден' }, { status: 404 })
    }

    if (user.phoneVerified) {
      return NextResponse.json({ message: 'Телефон уже подтверждён' }, { status: 200 })
    }

    const attempts = user.verificationAttempts ?? 0

    if (attempts >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { message: 'Превышено число попыток. Запросите новый код.' },
        { status: 429 },
      )
    }

    const expiresAt = user.verificationCodeExpiresAt
      ? new Date(user.verificationCodeExpiresAt).getTime()
      : 0

    if (!user.verificationCode || !expiresAt || expiresAt < Date.now()) {
      return NextResponse.json(
        { message: 'Код истёк. Запросите новый код.' },
        { status: 400 },
      )
    }

    if (user.verificationCode !== code) {
      const nextAttempts = attempts + 1
      await payload.update({
        collection: 'users',
        id: user.id,
        data: { verificationAttempts: nextAttempts },
        overrideAccess: true,
      })

      const left = MAX_ATTEMPTS - nextAttempts

      return NextResponse.json(
        {
          message:
            left > 0
              ? `Неверный код. Осталось попыток: ${left}`
              : 'Неверный код. Запросите новый код.',
          attemptsLeft: left,
        },
        { status: 400 },
      )
    }

    await payload.update({
      collection: 'users',
      id: user.id,
      data: {
        phoneVerified: true,
        verificationCode: null,
        verificationCodeExpiresAt: null,
        verificationAttempts: 0,
      },
      overrideAccess: true,
    })

    return NextResponse.json({ message: 'Телефон подтверждён' }, { status: 200 })
  } catch (error: unknown) {
    console.error('[verify-phone] Error:', error)
    return NextResponse.json({ message: 'Не удалось подтвердить телефон' }, { status: 500 })
  }
}
