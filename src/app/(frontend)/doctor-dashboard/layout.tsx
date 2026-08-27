import type { Metadata } from 'next'
import { PRIVATE_SECTION_METADATA } from '@/lib/seo'

/** Рабочий кабинет врача. */
export const metadata: Metadata = PRIVATE_SECTION_METADATA

export default function DoctorDashboardLayout({ children }: { children: React.ReactNode }) {
  return children
}
