import type { Metadata } from 'next'
import { PRIVATE_SECTION_METADATA } from '@/lib/seo'

/**
 * Кабинет врача, включая страницу входа /lk-med/login.
 *
 * Страницу входа закрываем сознательно: в выдаче она перетягивает на себя
 * запросы про врачей, а пациенту бесполезна.
 */
export const metadata: Metadata = PRIVATE_SECTION_METADATA

export default function LkMedLayout({ children }: { children: React.ReactNode }) {
  return children
}
