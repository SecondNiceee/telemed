/**
 * Returns the base path prefix for the application.
 * Uses NEXT_PUBLIC_BASE_PATH env variable (e.g. "/telemed-dev").
 * Returns empty string if not set.
 */
export function getBasePath(): string {
  return process.env.NEXT_PUBLIC_BASE_PATH || ''
}
