import type { MetadataRoute } from 'next'
import { PRIVATE_PATHS, SITE_URL, absoluteUrl } from '@/lib/seo'

/**
 * robots.txt для поисковых роботов.
 *
 * Закрытые разделы перечислены в PRIVATE_PATHS (src/lib/seo.ts) — тот же список
 * использует sitemap, поэтому страница не может одновременно попасть в карту
 * сайта и в запреты.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          // Личные кабинеты и админка: за логином робот видит пустой каркас.
          ...PRIVATE_PATHS.map((path) => `${path}/`),
          // API и служебные маршруты Payload не являются страницами.
          '/api/',
          // Комната звонка и оплата: одноразовые адреса конкретной записи.
          '/appointment/*/call',
          '/appointment/*/payment',
        ],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: SITE_URL,
  }
}
