import { NextRequest, NextResponse } from 'next/server'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { getAdminFromCookieHeader } from '@/lib/auth/adminSession'

export async function POST(req: NextRequest) {
  const admin = await getAdminFromCookieHeader(req.headers.get('cookie') || '')
  if (!admin) {
    return NextResponse.json({ message: 'Требуется вход администратора' }, { status: 401 })
  }

  try {
    const body = (await req.json()) as {
      name?: string
      slug?: string
      description?: string
      icon?: string
      iconImage?: number | null
    }
    const name = body.name?.trim()
    const slug = body.slug?.trim()

    if (!name || name.length < 2 || !slug) {
      return NextResponse.json(
        { message: 'Укажите название (минимум 2 символа) и URL-слаг' },
        { status: 400 },
      )
    }

    const payload = await getPayload({ config: configPromise })
    const category = await payload.create({
      collection: 'doctor-categories',
      data: {
        name,
        slug,
        description: body.description?.trim() || undefined,
        icon: body.icon?.trim() || undefined,
        iconImage: body.iconImage || undefined,
      },
      overrideAccess: true,
    })

    return NextResponse.json(category, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Не удалось создать специальность'
    if (message.includes('unique') || message.includes('duplicate')) {
      return NextResponse.json({ message: 'Такой URL-слаг уже используется' }, { status: 400 })
    }
    return NextResponse.json({ message }, { status: 500 })
  }
}
