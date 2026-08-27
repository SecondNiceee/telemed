import type { Metadata } from 'next'
import { PRIVATE_SECTION_METADATA } from '@/lib/seo'

/**
 * Конкретная запись пациента: /appointment/[id]/call и /appointment/[id]/payment.
 *
 * Сам раздел /appointment (выбор специалиста) остаётся открытым — закрыт только
 * уровень конкретной записи, где идёт звонок и оплата. Такие адреса привязаны к
 * одному пациенту и в индексе означали бы утечку приватных ссылок.
 */
export const metadata: Metadata = PRIVATE_SECTION_METADATA

export default function AppointmentDetailsLayout({ children }: { children: React.ReactNode }) {
  return children
}
