/**
 * Universal image URL resolver.
 *
 * Handles several kinds of input:
 *
 * 1) **Full URL (http:// or https://)** — already complete, returned as-is
 *    e.g. `https://smartcardio.ru/api/media/file/photo.jpg`
 *
 * 2) **Root-relative URL** — returned as-is
 *    e.g. `/api/media/file/photo.jpg`, `/images/logo.jpg`
 *    The app is served from the domain root, so root-relative URLs already
 *    resolve correctly both in SSR markup and in the browser.
 *
 * 3) **blob: / data: URLs** — passed through untouched
 *
 * If `url` is falsy the provided `fallback` (or `/placeholder.svg`) is returned.
 */
export function resolveImageUrl(
  url: string | null | undefined,
  fallback?: string,
): string {
  if (!url) {
    return fallback ?? '/placeholder.svg'
  }

  return url
}
