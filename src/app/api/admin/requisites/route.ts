import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { getAdminFromCookieHeader } from '@/lib/auth/adminSession'
import { SITE_SETTINGS_CACHE_TAG } from '@/lib/legal/operator.server'

/** Поля группы `operator` глобала site-settings, которые правит форма. */
const TEXT_FIELDS = [
  'legalName',
  'inn',
  'ogrn',
  'address',
  'email',
  'phone',
  'hostingLocation',
] as const

type TextField = (typeof TEXT_FIELDS)[number]

export interface RequisitesPayload extends Record<TextField, string> {
  rknNotificationSubmitted: boolean
}

/**
 * Сохранение реквизитов оператора из панели /admin.
 *
 * Валидация намеренно мягкая: поля можно оставить пустыми (документы тогда
 * честно покажут «не заполнено»), но если ИНН или ОГРН введены, они должны
 * быть похожи на настоящие. Опечатка в ИНН на юридической странице хуже,
 * чем пустое поле.
 */
export async function PUT(req: NextRequest) {
  const admin = await getAdminFromCookieHeader(req.headers.get('cookie') || '')
  if (!admin) {
    return NextResponse.json({ message: 'Требуется вход администратора' }, { status: 401 })
  }

  let body: Partial<RequisitesPayload>
  try {
    body = (await req.json()) as Partial<RequisitesPayload>
  } catch {
    return NextResponse.json({ message: 'Некорректное тело запроса' }, { status: 400 })
  }

  const data: Record<string, string | boolean> = {}
  for (const field of TEXT_FIELDS) {
    const raw = body[field]
    if (raw !== undefined && typeof raw !== 'string') {
      return NextResponse.json({ message: `Поле ${field} должно быть строкой` }, { status: 400 })
    }
    data[field] = (raw ?? '').trim()
  }
  data.rknNotificationSubmitted = body.rknNotificationSubmitted === true

  const inn = data.inn as string
  if (inn && !/^\d{10}$|^\d{12}$/.test(inn)) {
    return NextResponse.json({ message: 'ИНН состоит из 10 цифр (юрлицо) или 12 (ИП)' }, { status: 400 })
  }
  const ogrn = data.ogrn as string
  if (ogrn && !/^\d{13}$|^\d{15}$/.test(ogrn)) {
    return NextResponse.json(
      { message: 'ОГРН состоит из 13 цифр, ОГРНИП — из 15' },
      { status: 400 },
    )
  }
  const email = data.email as string
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ message: 'Проверьте формат email' }, { status: 400 })
  }

  try {
    const payload = await getPayload({ config: configPromise })
    const updated = await payload.updateGlobal({
      slug: 'site-settings',
      data: { operator: data },
      overrideAccess: true,
    })

    // Хук глобала тоже сбрасывает тег, но revalidateTag из хука срабатывает
    // не во всяком контексте (см. SiteSettings.ts). Здесь мы точно внутри
    // Route Handler, поэтому сбрасываем явно: юридические страницы должны
    // обновиться сразу после сохранения.
    revalidateTag(SITE_SETTINGS_CACHE_TAG)

    return NextResponse.json({ operator: updated.operator ?? {} })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Не удалось сохранить реквизиты'
    return NextResponse.json({ message }, { status: 500 })
  }
}
