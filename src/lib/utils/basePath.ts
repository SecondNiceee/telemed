/**
 * Returns the base path prefix for the application.
 * Uses NEXT_PUBLIC_BASE_PATH env variable (e.g. "/telemed-dev").
 *
 * IMPORTANT: must stay in sync with `basePath` in next.config.mjs,
 * otherwise static assets (/images/...) resolve to the wrong URL and 404.
 */
export const DEFAULT_BASE_PATH = '/telemed-dev'

export function getBasePath(): string {
  return process.env.NEXT_PUBLIC_BASE_PATH || DEFAULT_BASE_PATH;
}
