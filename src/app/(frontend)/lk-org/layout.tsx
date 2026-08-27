import type { Metadata } from 'next'
import { PRIVATE_SECTION_METADATA } from '@/lib/seo'

/** Кабинет организации: служебный раздел, индексация не нужна. */
export const metadata: Metadata = PRIVATE_SECTION_METADATA

export default function LkOrgLayout({ children }: { children: React.ReactNode }) {
  return children
}
