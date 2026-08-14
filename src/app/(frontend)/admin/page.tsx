import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { AdminPanel } from '@/components/admin/admin-panel'
import { getAdminFromCookieHeader, hasAnyUser } from '@/lib/auth/adminSession'
import type { AdminOrganisation } from '@/components/admin/types'

export const metadata = {
  title: 'Панель управления | smartcardio',
  description: 'Управление организациями платформы smartcardio',
}

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const requestHeaders = await headers()

  // Пустая база => показываем экран первичной настройки, вход не нужен.
  const needsSetup = !(await hasAnyUser())
  const admin = needsSetup ? null : await getAdminFromCookieHeader(requestHeaders.get('cookie') || '')

  // Данные грузим на сервере, чтобы панель открывалась уже заполненной.
  let organisations: AdminOrganisation[] = []
  if (admin) {
    const payload = await getPayload({ config })
    const { docs } = await payload.find({
      collection: 'organisations',
      limit: 200,
      sort: '-createdAt',
      depth: 0,
      overrideAccess: true,
    })
    organisations = docs.map((doc) => ({
      id: doc.id,
      name: doc.name,
      email: doc.email,
      createdAt: doc.createdAt,
    }))
  }

  return (
    <AdminPanel
      needsSetup={needsSetup}
      initialAdmin={
        admin ? { id: admin.id, name: admin.name ?? null, email: admin.email } : null
      }
      initialOrganisations={organisations}
    />
  )
}
