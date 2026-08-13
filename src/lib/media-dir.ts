import fs from 'fs'
import path from 'path'

/**
 * Absolute directory where Payload stores uploaded files.
 *
 * Payload uses `upload.staticDir` verbatim — a relative value like `'media'`
 * is resolved against `process.cwd()`, which differs between `next dev`,
 * `next start`, `standalone` output and PM2/systemd units that set another
 * working directory. That is why uploads could end up in an unexpected place
 * (or fail with EACCES/ENOENT) and why no `media/` folder appeared on the VPS.
 *
 * Override with MEDIA_DIR (e.g. MEDIA_DIR=/var/www/telemed/media) when the
 * files must live outside the deployment directory.
 */
export const MEDIA_DIR = path.isAbsolute(process.env.MEDIA_DIR || '')
  ? (process.env.MEDIA_DIR as string)
  : path.resolve(process.cwd(), process.env.MEDIA_DIR || 'media')

/**
 * Create the upload directory up-front so a missing folder or a wrong owner
 * surfaces in the server log at boot instead of killing an in-flight upload.
 */
export function ensureMediaDir(): void {
  try {
    fs.mkdirSync(MEDIA_DIR, { recursive: true })
    fs.accessSync(MEDIA_DIR, fs.constants.W_OK)
  } catch (err) {
    console.error('[media] upload directory is not usable', {
      dir: MEDIA_DIR,
      cwd: process.cwd(),
      error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    })
  }
}
