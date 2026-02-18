import { getBasePath } from './basePath'

/**
 * Universal image URL resolver.
 *
 * Handles two kinds of input:
 *
 * 1) **Payload API media URL**
 *    e.g. `http://localhost:3000/telemed-dev/api/media/file/photo.jpg`
 *    → strips `/api/media/file` segment → `http://localhost:3000/telemed-dev/media/photo.jpg`
 *
 * 2) **Local static asset**
 *    e.g. `/some-image.png`
 *    - On the client: returns the path as-is (browser resolves it relative to origin)
 *    - On the server: prepends `process.env.SERVER_URL` so fetch / SSR can reach it
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

  // --- Payload API media URL ---
  // Pattern: …/api/media/file/<filename>
  const payloadMediaRegex = /\/api\/media\/file\//
  if (payloadMediaRegex.test(url)) {
    // Replace `/api/media/file/` with `/media/`
    return url.replace(/\/api\/media\/file\//, '/media/')
  }

  // --- Local static asset (starts with `/`) ---
  if (url.startsWith('/')) {
    const isServer = typeof window === 'undefined'
    if (isServer) {
      const serverUrl = (process.env.SERVER_URL || 'http://localhost:3000').replace(
        /\/$/,
        '',
      )
      return `${serverUrl}${url}`
    }
    // Client-side: keep the path as-is
    return url
  }

  // Anything else (full external URL, blob:, data:, etc.) — pass through
  return url
}
