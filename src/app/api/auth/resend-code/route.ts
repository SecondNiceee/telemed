import { type NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { normalizePhone } from '@/utils/phone'
import { getResendWaitMs, issueCodeForUser, RESEND_COOLDOWN_MS } from '@/utils/verificationCode'

type ResendBody = {
  phone?: string
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ResendBody
    const phone = normalizePhone(body.phone)

    if (!phone) {
      return NextResponse.json({ message: 'Укажите корректный номер телефона' }, { status: 400 })
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

    const waitMs = getResendWaitMs(user.verificationCodeSentAt)
    if (waitMs > 0) {
      const retryAfter = Math.ceil(waitMs / 1000)
      return NextResponse.json(
        { message: `Повторная отправка возможна через ${retryAfter} сек.`, retryAfter },
        { status: 429 },
      )
    }

    await issueCodeForUser({ payload, userId: user.id, phone })

    return NextResponse.json(
      { message: 'Новый код отправлен', resendAfter: RESEND_COOLDOWN_MS / 1000 },
      { status: 200 },
    )
  } catch (error: unknown) {
    console.error('[resend-code] Error:', error)
    return NextResponse.json({ message: 'Не удалось отправить код' }, { status: 500 })
  }
}
