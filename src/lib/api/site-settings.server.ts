import 'server-only'
import { unstable_cache } from 'next/cache'
import type { SiteSettings } from './site-settings'

/** Cache tag used for site settings. Revalidated via SiteSettings hooks. */
export const SITE_SETTINGS_CACHE_TAG = 'site-settings'

/**
 * Internal function to fetch site settings via Payload Local API.
 */
async function fetchSiteSettingsInternal(): Promise<SiteSettings | null> {
  try {
    const { getPayload } = await import('payload')
    const configPromise = await import('@/payload.config')
    const payload = await getPayload({ config: configPromise.default })
    
    const data = await payload.findGlobal({
      slug: 'site-settings',
    })
    
    return data as unknown as SiteSettings
  } catch {
    return null
  }
}

/**
 * Server-side only: Fetch site settings using Payload Local API.
 * This works during build time when the HTTP server isn't running yet.
 * Wrapped with unstable_cache to support revalidateTag in production.
 */
export const fetchSiteSettingsLocal = unstable_cache(
  fetchSiteSettingsInternal,
  ['site-settings-local'],
  { tags: [SITE_SETTINGS_CACHE_TAG] }
)
