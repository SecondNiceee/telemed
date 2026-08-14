import fs from 'fs/promises'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import configPromise from '@payload-config'
import { getPayload, type Payload } from 'payload'
import { getAdminFromCookieHeader } from '@/lib/auth/adminSession'
import { revalidatePath, revalidateTag } from 'next/cache'
import {
  MOCK_CATEGORIES,
  MOCK_DOCTORS,
  buildMockSchedule,
  type MockCategory,
} from '@/lib/seed/mock-data'
import { CATEGORIES_CACHE_TAG } from '@/lib/api/categories'
import { DOCTORS_CACHE_TAG } from '@/lib/api/doctors'

/** Демо-данные создаются только из панели администратора. */
async function requireAdmin(req: NextRequest) {
  const admin = await getAdminFromCookieHeader(req.headers.get('cookie') || '')
  if (!admin) {
    return {
      error: NextResponse.json({ message: 'Требуется вход администратора' }, { status: 401 }),
    }
  }
  return { admin }
}

function describe(err: unknown) {
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err)
}

/**
 * Сбрасывает кэш каталога после сидирования.
 *
 * Хуки коллекций дёргают только теги, а главная и /appointment — это ISR-страницы
 * (revalidate = 60) с unstable_cache внутри, страницы категорий и врачей тоже
 * кэшируются на уровне маршрута. Поэтому свежие демо-данные могли не появиться
 * сразу. Сбрасываем и теги, и сами маршруты — сид редкая операция, экономить не на чем.
 */
function revalidateCatalog() {
  try {
    revalidateTag(CATEGORIES_CACHE_TAG)
    revalidateTag(DOCTORS_CACHE_TAG)
    revalidatePath('/')
    revalidatePath('/appointment')
    revalidatePath('/category/[id]', 'page')
    revalidatePath('/doctor/[id]', 'page')
  } catch (err) {
    // Кэш — не причина считать сидирование неуспешным.
    console.error('[admin:seed] revalidation failed', describe(err))
  }
}

/**
 * Категория по слагу: сначала ищем, потом создаём.
 * Слаг уникален, поэтому это надёжный ключ идемпотентности.
 */
async function ensureCategory(
  payload: Payload,
  category: MockCategory,
): Promise<{ id: number | string; created: boolean }> {
  const existing = await payload.find({
    collection: 'doctor-categories',
    where: { slug: { equals: category.slug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (existing.totalDocs > 0) {
    return { id: existing.docs[0].id, created: false }
  }

  const doc = await payload.create({
    collection: 'doctor-categories',
    data: {
      name: category.name,
      slug: category.slug,
      description: category.description,
      icon: category.icon,
    },
    overrideAccess: true,
  })

  return { id: doc.id, created: true }
}

/**
 * Загружает фото врача из public/mock-data в коллекцию media.
 * Возвращает два документа: обрезанный (показывается везде) и оригинал —
 * так же, как это делает кабинет организации. Файлы у нас уже квадратные,
 * поэтому оба создаются из одного буфера.
 */
async function uploadDoctorPhoto(payload: Payload, fileName: string, alt: string) {
  const filePath = path.join(process.cwd(), 'public', 'mock-data', fileName)
  const buffer = await fs.readFile(filePath)

  const create = (name: string) =>
    payload.create({
      collection: 'media',
      data: { alt },
      file: {
        data: buffer,
        mimetype: 'image/png',
        name,
        size: buffer.length,
      },
      overrideAccess: true,
    })

  const photo = await create(fileName)
  const original = await create(fileName.replace(/\.png$/, '-original.png'))

  return { photoId: photo.id, photoOriginalId: original.id }
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (guard.error) return guard.error

  let body: { type?: string; organisationId?: string | number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: 'Некорректное тело запроса' }, { status: 400 })
  }

  const payload = await getPayload({ config: configPromise })

  if (body.type === 'categories') {
    let created = 0
    let skipped = 0
    const failed: string[] = []

    for (const category of MOCK_CATEGORIES) {
      try {
        const result = await ensureCategory(payload, category)
        if (result.created) created += 1
        else skipped += 1
      } catch (err) {
        console.error('[admin:seed] category failed', { slug: category.slug, error: describe(err) })
        failed.push(category.name)
      }
    }

    if (created > 0) revalidateCatalog()

    return NextResponse.json({
      type: 'categories',
      created,
      skipped,
      failed,
      total: MOCK_CATEGORIES.length,
    })
  }

  if (body.type === 'doctors') {
    // id организации в postgres — number. Клиент присылает его строкой (JSON),
    // а relationship при создании врача строку не принимает и падает с
    // «The following field is invalid: Организация». Приводим тип здесь, один
    // раз, до всех обращений к payload.
    const organisationId = Number(body.organisationId)
    if (!body.organisationId || !Number.isInteger(organisationId)) {
      return NextResponse.json({ message: 'Выберите организацию' }, { status: 400 })
    }

    try {
      await payload.findByID({
        collection: 'organisations',
        id: organisationId,
        depth: 0,
        overrideAccess: true,
      })
    } catch {
      return NextResponse.json({ message: 'Организация не найдена' }, { status: 404 })
    }

    let created = 0
    let skipped = 0
    const failed: string[] = []

    for (const doctor of MOCK_DOCTORS) {
      // Фото грузятся до создания врача (нужны их id). Если create упадёт,
      // media останутся висеть сиротами — поэтому запоминаем их и убираем в catch.
      const uploadedMedia: (number | string)[] = []
      try {
        const existing = await payload.find({
          collection: 'doctors',
          where: { email: { equals: doctor.email } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        if (existing.totalDocs > 0) {
          skipped += 1
          continue
        }

        // Специальности врача: если категорий ещё нет — создаём их по пути,
        // чтобы «Врачи» работали и без предварительного нажатия «Категории».
        const categoryIds: (number | string)[] = []
        for (const slug of doctor.categorySlugs) {
          const definition = MOCK_CATEGORIES.find((item) => item.slug === slug)
          if (!definition) continue
          const { id } = await ensureCategory(payload, definition)
          categoryIds.push(id)
        }

        const { photoId, photoOriginalId } = await uploadDoctorPhoto(
          payload,
          doctor.photoFile,
          doctor.name,
        )
        uploadedMedia.push(photoId, photoOriginalId)

        await payload.create({
          collection: 'doctors',
          data: {
            name: doctor.name,
            email: doctor.email,
            password: doctor.password,
            organisation: organisationId,
            categories: categoryIds as number[],
            experience: doctor.experience,
            price: doctor.price,
            degree: doctor.degree,
            bio: doctor.bio,
            education: doctor.education.map((value) => ({ value })),
            services: doctor.services.map((value) => ({ value })),
            photo: photoId as number,
            photoOriginal: photoOriginalId as number,
            slotDuration: '30',
            // Без расписания врач невидим на /category/{slug}?date=... и к нему
            // нельзя записаться — демо-данные были бы бесполезны.
            schedule: buildMockSchedule(),
          },
          overrideAccess: true,
        })

        created += 1
      } catch (err) {
        console.error('[admin:seed] doctor failed', { email: doctor.email, error: describe(err) })
        failed.push(doctor.name)

        for (const id of uploadedMedia) {
          try {
            await payload.delete({ collection: 'media', id, overrideAccess: true })
          } catch (cleanupErr) {
            console.error('[admin:seed] failed to clean up media', { id, error: describe(cleanupErr) })
          }
        }
      }
    }

    if (created > 0) revalidateCatalog()

    return NextResponse.json({
      type: 'doctors',
      created,
      skipped,
      failed,
      total: MOCK_DOCTORS.length,
    })
  }

  return NextResponse.json({ message: 'Неизвестный тип тестовых данных' }, { status: 400 })
}
