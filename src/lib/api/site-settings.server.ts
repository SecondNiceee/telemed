import 'server-only'
import type { SiteSettings } from './site-settings'

/**
 * Server-side only: Fetch site settings using Payload Local API.
 * This works during build time when the HTTP server isn't running yet.
 */
export async function fetchSiteSettingsLocal(): Promise<SiteSettings | null> {
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
