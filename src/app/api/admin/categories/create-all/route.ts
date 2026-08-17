import { revalidatePath, revalidateTag } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { getAdminFromCookieHeader } from '@/lib/auth/adminSession'
import { CATEGORIES_CACHE_TAG } from '@/lib/api/categories.server'
import { CLINIC_CATEGORIES } from '@/lib/data/clinic-categories'

export async function POST(req: NextRequest) {
  const admin = await getAdminFromCookieHeader(req.headers.get('cookie') || '')
  if (!admin) {
    return NextResponse.json({ message: 'Требуется вход администратора' }, { status: 401 })
  }

  const payload = await getPayload({ config: configPromise })
  const slugs = CLINIC_CATEGORIES.map((category) => category.slug)
  const existing = await payload.find({
    collection: 'doctor-categories',
    where: { slug: { in: slugs } },
    limit: slugs.length,
    depth: 0,
    overrideAccess: true,
  })
  const existingSlugs = new Set(existing.docs.map((category) => category.slug))
  const created = []
  const errors: Array<{ slug: string; message: string }> = []
  let skipped = 0

  for (const category of CLINIC_CATEGORIES) {
    if (existingSlugs.has(category.slug)) {
      skipped += 1
      continue
    }

    try {
      const doc = await payload.create({
        collection: 'doctor-categories',
        data: category,
        overrideAccess: true,
      })
      created.push(doc)
    } catch (error) {
      errors.push({
        slug: category.slug,
        message: error instanceof Error ? error.message : 'Не удалось создать специальность',
      })
    }
  }

  if (created.length > 0) {
    revalidateTag(CATEGORIES_CACHE_TAG)
    revalidatePath('/')
    revalidatePath('/appointment')
    revalidatePath('/admin/categories')
  }

  return NextResponse.json({
    categories: created,
    created: created.length,
    skipped,
    failed: errors.length,
    total: CLINIC_CATEGORIES.length,
    errors,
  })
}
