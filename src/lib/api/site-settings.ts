import { apiFetch } from './fetch'

export interface FaqItem {
  question: string
  answer: string
  id?: string
}

export interface SiteSettings {
  heroTitle: string
  heroSubtitle?: string
  faq?: FaqItem[]
}

export const SiteSettingsApi = {
  async fetch(): Promise<SiteSettings> {
    return apiFetch<SiteSettings>('/api/globals/site-settings')
  },
}
