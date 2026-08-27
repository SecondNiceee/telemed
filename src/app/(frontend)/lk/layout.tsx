import type { Metadata } from 'next'
import { PRIVATE_SECTION_METADATA } from '@/lib/seo'

/**
 * Личный кабинет пациента закрыт от поисковиков: за логином робот видит пустой
 * каркас, а здесь ещё и медицинские данные, которым в выдаче не место.
 */
export const metadata: Metadata = PRIVATE_SECTION_METADATA

export default function LkLayout({ children }: { children: React.ReactNode }) {
  return children
}
