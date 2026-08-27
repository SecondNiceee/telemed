import type { Metadata } from 'next'
import { PRIVATE_SECTION_METADATA } from '@/lib/seo'

/** Административная панель платформы. */
export const metadata: Metadata = PRIVATE_SECTION_METADATA

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children
}
