import { NextRequest, NextResponse } from 'next/server'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { getAdminFromCookieHeader } from '@/lib/auth/adminSession'

async function requireAdmin(req: NextRequest) {
  return getAdminFromCookieHeader(req.headers.get('cookie') || '')
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(req)
  if (!admin) {
    return NextResponse.json({ message: 'Требуется вход администратора' }, { status: 401 })
  }

  try {
    const { id } = await params
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
    const category = await payload.update({
      collection: 'doctor-categories',
      id,
      data: {
        name,
        slug,
        description: body.description?.trim() || null,
        icon: body.icon?.trim() || null,
        ...(body.iconImage !== undefined ? { iconImage: body.iconImage } : {}),
      },
      overrideAccess: true,
    })
    return NextResponse.json(category)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Не удалось обновить специальность'
    if (message.includes('unique') || message.includes('duplicate')) {
      return NextResponse.json({ message: 'Такой URL-слаг уже используется' }, { status: 400 })
    }
    return NextResponse.json({ message }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(req)
  if (!admin) {
    return NextResponse.json({ message: 'Требуется вход администратора' }, { status: 401 })
  }

  try {
    const { id } = await params
    const payload = await getPayload({ config: configPromise })
    const linkedDoctors = await payload.find({
      collection: 'doctors',
      where: { categories: { in: [id] } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (linkedDoctors.totalDocs > 0) {
      return NextResponse.json(
        { message: 'Нельзя удалить специальность, к которой привязаны врачи' },
        { status: 400 },
      )
    }

    await payload.delete({
      collection: 'doctor-categories',
      id,
      overrideAccess: true,
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Не удалось удалить специальность' },
      { status: 500 },
    )
  }
}
