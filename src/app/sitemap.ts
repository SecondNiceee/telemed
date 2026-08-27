import type { MetadataRoute } from 'next'
import { absoluteUrl } from '@/lib/seo'

/**
 * Карта сайта: только публичные страницы.
 *
 * Личные кабинеты и админка сюда не попадают по построению — мы перечисляем
 * статические адреса вручную, а из базы берём лишь врачей и категории, то есть
 * ровно те сущности, у которых есть открытая страница.
 */

/**
 * Пересобирается раз в час.
 *
 * Карта строится из базы, поэтому полностью статическая сборка означала бы
 * устаревший список врачей до следующего деплоя.
 */
export const revalidate = 3600

interface SitemapEntity {
  id: number | string
  /**
   * Только у категорий.
   *
   * Адрес категории — /category/<slug>, а не /category/<id>: страница читает
   * сегмент через fetchCategoryBySlug. Подстановка id дала бы 404 на каждой
   * ссылке в карте сайта.
   */
  slug?: string | null
  updatedAt?: string | null
}

/**
 * Читает опубликованные сущности напрямую через локальный API Payload.
 *
 * depth: 0 и select — чтобы не тянуть фото, расписания и связи: для карты сайта
 * нужны только идентификатор и дата изменения.
 */
async function fetchEntities(collection: 'doctors' | 'doctor-categories'): Promise<SitemapEntity[]> {
  const { getPayload } = await import('payload')
  const config = await import('@/payload.config')
  const payload = await getPayload({ config: config.default })

  const result = await payload.find({
    collection,
    depth: 0,
    pagination: false,
    // slug есть только у категорий; для врачей Payload просто вернёт поле пустым.
    select: { updatedAt: true, slug: true },
  })

  return result.docs as unknown as SitemapEntity[]
}

/**
 * Безопасная обёртка над запросом к базе.
 *
 * Карта сайта не должна ронять сборку: если база недоступна (например, на
 * превью без DATABASE_URL), лучше отдать карту из статических адресов, чем
 * получить провалившийся деплой всего приложения.
 */
async function safeFetch(collection: 'doctors' | 'doctor-categories'): Promise<SitemapEntity[]> {
  try {
    return await fetchEntities(collection)
  } catch (error) {
    console.error(`[sitemap] Не удалось получить ${collection}:`, error)
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl('/'),
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: absoluteUrl('/appointment'),
      lastModified: now,
      changeFrequency: 'daily',
      // Ключевая страница воронки: с неё начинается запись к врачу.
      priority: 0.9,
    },
  ]

  const [doctors, categories] = await Promise.all([
    safeFetch('doctors'),
    safeFetch('doctor-categories'),
  ])

  const doctorRoutes: MetadataRoute.Sitemap = doctors.map((doctor) => ({
    url: absoluteUrl(`/doctor/${doctor.id}`),
    lastModified: doctor.updatedAt ? new Date(doctor.updatedAt) : now,
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  const categoryRoutes: MetadataRoute.Sitemap = categories
    // Без slug страницы категории не существует, поэтому такую запись пропускаем.
    .filter((category): category is SitemapEntity & { slug: string } => Boolean(category.slug))
    .map((category) => ({
      url: absoluteUrl(`/category/${category.slug}`),
      lastModified: category.updatedAt ? new Date(category.updatedAt) : now,
      changeFrequency: 'weekly',
      priority: 0.7,
    }))

  return [...staticRoutes, ...doctorRoutes, ...categoryRoutes]
}
