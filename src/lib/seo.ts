import type { Metadata } from 'next'

/**
 * Единая точка правды для SEO-метаданных.
 *
 * Здесь собраны только те данные, которые действительно есть в проекте:
 * адрес из SERVER_URL, название бренда и фирменный цвет из globals.css.
 * Ничего не выдумываем: если для страницы нет осмысленного описания, лучше
 * оставить общее, чем сочинять несуществующие услуги или регалии.
 */

export const SITE_NAME = 'smartcardio'

/** Цвет --primary из globals.css, пересчитанный из oklch(0.4989 0.1406 299.8). */
export const BRAND_COLOR = '#704ca6'

/**
 * Базовый адрес сайта.
 *
 * Берётся из окружения, потому что домен обязан различаться между продом и
 * превью: иначе canonical и ссылки в sitemap уводили бы поисковик с превью на
 * прод (или наоборот). Резервное значение — боевой домен из .env.example.
 *
 * NEXT_PUBLIC_SITE_URL имеет приоритет: он доступен и в браузере, тогда как
 * SERVER_URL существует только на сервере.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.SERVER_URL ||
  'https://telemed.smartcardio.ru'
).replace(/\/+$/, '')

/** Абсолютный адрес: нужен для OG-тегов и sitemap, где относительные пути недопустимы. */
export function absoluteUrl(path = '/'): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

/**
 * Разделы, закрытые авторизацией.
 *
 * Один список на весь проект: его читают и robots.txt, и sitemap. Держать их
 * в разных местах опасно — рассинхрон приводит к тому, что закрытая страница
 * попадает в sitemap и поисковик считает её ошибкой.
 */
export const PRIVATE_PATHS = [
  '/admin',
  '/lk',
  '/lk-org',
  '/lk-med',
  '/doctor-dashboard',
  '/reset-password',
  '/verify-email',
] as const

interface BuildMetadataOptions {
  /** Заголовок без названия бренда: суффикс добавляет шаблон в корневом layout. */
  title: string
  description: string
  /** Путь страницы для canonical, например '/appointment'. */
  path?: string
  /**
   * false — закрыть страницу от индексации.
   *
   * Для личных кабинетов это не «на всякий случай»: страница за логином
   * отдаёт роботу пустой каркас, и такие страницы в выдаче портят оценку
   * качества всего домена.
   */
  index?: boolean
  /** Ключевые слова: только если они честно описывают содержимое страницы. */
  keywords?: string[]
}

/**
 * Собирает метаданные страницы с canonical и Open Graph.
 *
 * Canonical задаётся относительным путём — Next сам развернёт его через
 * metadataBase, поэтому смена домена не требует правок по страницам.
 */
export function buildMetadata({
  title,
  description,
  path,
  index = true,
  keywords,
}: BuildMetadataOptions): Metadata {
  const canonical = path ?? undefined

  return {
    title,
    description,
    ...(keywords?.length ? { keywords } : {}),
    ...(canonical ? { alternates: { canonical } } : {}),
    robots: index
      ? { index: true, follow: true }
      : // nocache и noimageindex — чтобы закрытые страницы не оставались
        // в кеше и превью поисковика после того, как их убрали из индекса.
        { index: false, follow: false, nocache: true, noimageindex: true },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: 'ru_RU',
      title,
      description,
      ...(path ? { url: absoluteUrl(path) } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}
