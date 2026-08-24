import type { PayloadRequest } from 'payload'

/**
 * Пересчёт денормализованного рейтинга врача.
 *
 * Зачем поля на враче, а не агрегат на каждый рендер: список врачей в категории
 * сортируется по рейтингу, то есть балл нужен сразу по всем врачам выдачи.
 * Считать его на каждый запрос страницы — это лишний проход по всем отзывам
 * всех показанных врачей; вместо этого пишем результат один раз при изменении
 * отзыва, а страницы просто читают готовое число вместе с самим врачом.
 */

/** Знаков после запятой у среднего балла. Хватает для «4.67». */
const RATING_DECIMALS = 2

/** Достаёт id связи, которая может прийти и числом, и populated-документом. */
export function toDoctorId(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === 'object') {
    const id = (value as { id?: number | string }).id
    return id == null ? null : Number(id)
  }
  const id = Number(value)
  return Number.isFinite(id) ? id : null
}

/**
 * Считает средний балл врача по его отзывам и пишет результат в самого врача.
 *
 * Обязательно с `req`: операция вызывается из хуков коллекции отзывов и должна
 * идти в той же транзакции. Без него `find` не увидел бы только что созданный
 * (или удалённый) отзыв — он ещё не закоммичен — и рейтинг разъехался бы с
 * фактическими отзывами. Плюс атомарность: откат отзыва откатывает и рейтинг.
 *
 * Считаем всегда полностью, а не инкрементом (+1 отзыв к сумме): полный
 * пересчёт одинаково корректно отрабатывает создание, изменение оценки,
 * удаление и перенос отзыва другому врачу, а ещё лечит возможный дрейф —
 * если два отзыва одному врачу закоммитились одновременно и один не попал в
 * чужой снапшот, следующий же отзыв пересчитает всё с нуля.
 */
export async function recalculateDoctorRating({
  req,
  doctorId,
}: {
  req: PayloadRequest
  doctorId: number | null
}): Promise<void> {
  if (doctorId == null || !Number.isFinite(doctorId)) return

  const { payload } = req

  try {
    const { docs } = await payload.find({
      collection: 'feedbacks',
      where: { doctor: { equals: doctorId } },
      depth: 0,
      pagination: false,
      // Из БД тянем только оценку: текст отзывов и связи для агрегата не нужны.
      select: { rating: true },
      req,
      overrideAccess: true,
    })

    let sum = 0
    let count = 0
    for (const doc of docs) {
      const rating = Number(doc.rating)
      if (!Number.isFinite(rating)) continue
      sum += rating
      count += 1
    }

    const factor = 10 ** RATING_DECIMALS
    // Ни одного отзыва — это отсутствие рейтинга, а не ноль: иначе новый врач
    // выглядел бы хуже врача с оценкой 1 и уезжал в конец сортировки.
    const rating = count === 0 ? null : Math.round((sum / count) * factor) / factor

    await payload.update({
      collection: 'doctors',
      id: doctorId,
      data: { rating, reviewsCount: count },
      depth: 0,
      req,
      // Внутренний пересчёт: он не должен зависеть от прав того, кто оставил
      // отзыв (пациент врача редактировать не может), а сами поля закрыты
      // на запись через field-level access.
      overrideAccess: true,
    })
  } catch (error) {
    // Рейтинг — производная величина. Уронить из-за него сохранение отзыва
    // нельзя: пациент уже поставил оценку, и она в БД. Расхождение вылечит
    // следующий отзыв этому врачу (пересчёт всегда полный) либо миграция.
    console.error('[doctor-rating] не удалось пересчитать рейтинг врача', {
      doctorId,
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    })
  }
}

/**
 * Пересчитывает рейтинг у всех затронутых врачей.
 *
 * Список бывает из двух id: админ может перевесить отзыв на другого врача —
 * тогда пересчёт нужен и прежнему, и новому.
 */
export async function recalculateDoctorRatings({
  req,
  doctorIds,
}: {
  req: PayloadRequest
  doctorIds: (number | null)[]
}): Promise<void> {
  const unique = [...new Set(doctorIds.filter((id): id is number => id != null))]
  for (const doctorId of unique) {
    await recalculateDoctorRating({ req, doctorId })
  }
}
