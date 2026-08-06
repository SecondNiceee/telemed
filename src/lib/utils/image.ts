import { getBasePath } from './basePath'

/**
 * Universal image URL resolver.
 *
 * Handles several kinds of input:
 *
 * 1) **Full URL with /api/media/file/** - already complete, return as-is
 *    e.g. `https://smartcardio.ru/telemed-dev/api/media/file/photo.jpg`
 *
 * 2) **Relative Payload API media URL**
 *    e.g. `/api/media/file/photo.jpg` (without basePath)
 *    → prepends basePath → `/telemed-dev/api/media/file/photo.jpg`
 *
 * 3) **Local static asset**
 *    e.g. `/some-image.png`
 *    - On the client: prepends basePath for browser
 *    - On the server: prepends SERVER_URL for fetch
 *
 * If `url` is falsy the provided `fallback` (or basePath + `/placeholder.svg`) is returned.
 */
export function resolveImageUrl(
  url: string | null | undefined,
  fallback?: string,
): string {
  if (!url) {
    return fallback ?? `${getBasePath()}/placeholder.svg`
  }

  // --- Full URL (http:// or https://) ---
  // Check if it's a media URL that needs basePath injection
  if (url.startsWith('http://') || url.startsWith('https://')) {
    const base = getBasePath()
    // If basePath is configured and URL contains /api/media/file/ but NOT basePath
    if (base && url.includes('/api/media/file/') && !url.includes(base)) {
      // Insert basePath before /api/media/file/
      return url.replace('/api/media/file/', `${base}/api/media/file/`)
    }
    return url
  }

  // --- Payload API media URL ---
  // Pattern: /api/media/file/<filename> (relative, without basePath)
  // Need to prepend basePath if not already present
  const payloadMediaRegex = /\/api\/media\/file\//
  if (payloadMediaRegex.test(url)) {
    const base = getBasePath()
    // If URL already starts with basePath, return as-is
    if (base && url.startsWith(base)) {
      return url
    }
    // Prepend basePath
    return `${base}${url}`
  }

  // --- Local static asset (starts with `/`) ---
  if (url.startsWith('/')) {
    const base = getBasePath() // e.g. "/telemed-dev" or ""

    // If the URL already starts with basePath, don't double-prefix
    if (base && url.startsWith(base)) {
      const isServer = typeof window === 'undefined'
      if (isServer) {
        const serverUrl = (process.env.SERVER_URL || 'http://localhost:3000').replace(
          /\/$/,
          '',
        )
        return `${serverUrl}${url}`
      }
      return url
    }

    const prefixedUrl = `${base}${url}` // e.g. "/telemed-dev/images/logo.jpg"

    const isServer = typeof window === 'undefined'
    if (isServer) {
      const serverUrl = (process.env.SERVER_URL || 'http://localhost:3000').replace(
        /\/$/,
        '',
      )
      return `${serverUrl}${url}`
    }
    // Client-side: return with basePath prefix so the browser resolves correctly
    return prefixedUrl
  }

  // Anything else (blob:, data:, etc.) — pass through
  return url
}
