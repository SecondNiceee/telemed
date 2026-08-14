import { NextRequest, NextResponse } from 'next/server'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { getAdminFromCookieHeader } from '@/lib/auth/adminSession'
import { generatePassword } from '@/lib/generate-password'

/** Каждый роут панели сам проверяет админа — cookie обычного юзера тут не проходит. */
async function requireAdmin(req: NextRequest) {
  const admin = await getAdminFromCookieHeader(req.headers.get('cookie') || '')
  if (!admin) {
    return { error: NextResponse.json({ message: 'Требуется вход администратора' }, { status: 401 }) }
  }
  return { admin }
}

/** Список организаций для таблицы в панели. */
export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (guard.error) return guard.error

  const payload = await getPayload({ config: configPromise })

  const { docs, totalDocs } = await payload.find({
    collection: 'organisations',
    limit: 200,
    sort: '-createdAt',
    depth: 0,
    overrideAccess: true,
  })

  return NextResponse.json({
    total: totalDocs,
    organisations: docs.map((doc) => ({
      id: doc.id,
      name: doc.name,
      email: doc.email,
      createdAt: doc.createdAt,
    })),
  })
}

/**
 * Создание организации. Пароль либо задаёт админ, либо генерируем сами —
 * в ответе он отдаётся ОДИН раз, дальше в базе только хэш.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (guard.error) return guard.error

  try {
    const body = (await req.json()) as { name?: string; email?: string; password?: string }

    const name = body.name?.trim()
    const email = body.email?.trim().toLowerCase()

    if (!name || !email) {
      return NextResponse.json({ message: 'Укажите название и email' }, { status: 400 })
    }

    const password = body.password?.trim() ? body.password.trim() : generatePassword()
    if (password.length < 8) {
      return NextResponse.json({ message: 'Пароль минимум 8 символов' }, { status: 400 })
    }

    const payload = await getPayload({ config: configPromise })

    const existing = await payload.find({
      collection: 'organisations',
      where: { email: { equals: email } },
      limit: 1,
      overrideAccess: true,
    })
    if (existing.totalDocs > 0) {
      return NextResponse.json(
        { message: 'Организация с таким email уже существует' },
        { status: 409 },
      )
    }

    const org = await payload.create({
      collection: 'organisations',
      data: { name, email, password },
      overrideAccess: true,
    })

    return NextResponse.json({
      organisation: { id: org.id, name: org.name, email: org.email, createdAt: org.createdAt },
      // Единственный момент, когда пароль видно в открытом виде.
      credentials: { email, password },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Не удалось создать организацию'
    return NextResponse.json({ message }, { status: 400 })
  }
}
