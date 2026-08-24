import 'server-only'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { DoctorRatingsMap } from '@/lib/utils/doctor-rating'

/**
 * Считает средний балл по отзывам для списка врачей одним запросом.
 *
 * Почему local API, а не REST: страница категории и так рендерится динамически
 * (есть searchParams), а `select` + `pagination: false` тянут из БД только две
 * колонки по всем нужным врачам сразу — без N запросов на карточку и без
 * похода через HTTP на собственный сервер.
 *
 * Отзывы публичны на чтение, но выборка идёт с `overrideAccess: true`:
 * агрегат обезличен (только doctor + rating), а гость иначе получил бы
 * лишний проход по access-контролю на каждый документ.
 */
export async function fetchDoctorRatings(doctorIds: number[]): Promise<DoctorRatingsMap> {
  if (doctorIds.length === 0) return {}

  try {
    const payload = await getPayload({ config })
    const { docs } = await payload.find({
      collection: 'feedbacks',
      where: { doctor: { in: doctorIds } },
      depth: 0,
      pagination: false,
      select: { doctor: true, rating: true },
      overrideAccess: true,
    })

    const totals = new Map<number, { sum: number; count: number }>()

    for (const doc of docs) {
      // depth: 0 отдаёт связь числом, но подстрахуемся от populated-документа.
      const rawDoctor: unknown = doc.doctor
      const doctorId =
        typeof rawDoctor === 'object' && rawDoctor !== null && 'id' in rawDoctor
          ? Number((rawDoctor as { id: number | string }).id)
          : Number(rawDoctor)

      const rating = Number(doc.rating)
      if (!Number.isFinite(doctorId) || !Number.isFinite(rating)) continue

      const acc = totals.get(doctorId) ?? { sum: 0, count: 0 }
      acc.sum += rating
      acc.count += 1
      totals.set(doctorId, acc)
    }

    const ratings: DoctorRatingsMap = {}
    for (const [doctorId, { sum, count }] of totals) {
      ratings[doctorId] = { average: sum / count, count }
    }

    return ratings
  } catch (error) {
    // Рейтинг — украшение списка, а не его условие: при сбое показываем
    // врачей без рейтинга вместо страницы с ошибкой.
    console.error('[doctor-ratings] не удалось посчитать средний балл:', error)
    return {}
  }
}
