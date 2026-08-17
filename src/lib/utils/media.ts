/**
 * Приведение URL файла из Payload к виду, который принимает оптимизатор
 * next/image (`/_next/image`).
 *
 * Зачем: в payload.config.ts задан `serverURL`, поэтому Payload может отдать
 * `url` медиа абсолютной ссылкой (`https://smartcardio.ru/api/media/file/x.jpg`).
 * Оптимизатор Next по умолчанию работает только с путями своего origin, а любой
 * внешний хост требует записи в `images.remotePatterns`. Файлы лежат локально
 * (Media.upload.staticDir) и раздаются самим приложением, поэтому вместо
 * настройки remotePatterns достаточно срезать origin и оставить путь —
 * картинка остаётся той же, но становится «локальной» для оптимизатора.
 *
 * Возвращает null, если ссылки нет — вызывающий код показывает заглушку.
 */
export function toOptimizableMediaSrc(url?: string | null): string | null {
  if (!url) return null

  const trimmed = url.trim()
  if (!trimmed) return null

  // Уже относительный путь — отдаём как есть.
  if (trimmed.startsWith("/")) return trimmed

  // data:/blob: оптимизатор не принимает — такие ссылки обрабатывает
  // вызывающий код обычным <img> (см. превью в формах lk-org).
  if (!/^https?:\/\//i.test(trimmed)) return null

  try {
    const parsed = new URL(trimmed)
    // Срезаем origin только у файлов, которые раздаёт само приложение.
    // Для сторонних хостов (CDN) путь без origin сломал бы ссылку.
    if (parsed.pathname.startsWith("/api/media/") || parsed.pathname.startsWith("/media/")) {
      return `${parsed.pathname}${parsed.search}`
    }
    return trimmed
  } catch {
    return null
  }
}
