import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getAdminFromCookieHeader } from '@/lib/auth/adminSession'
import { AdminCategoriesScreen } from '@/components/admin/admin-categories-screen'
import type { AdminCategory } from '@/components/admin/types'

export const metadata = {
  title: 'Специальности',
  description: 'Управление специальностями врачей платформы smartcardio',
}

export const dynamic = 'force-dynamic'

export default async function AdminCategoriesPage() {
  const requestHeaders = await headers()

  // Доступ только администратору. Без сессии возвращаем на экран входа /admin.
  const admin = await getAdminFromCookieHeader(requestHeaders.get('cookie') || '')
  if (!admin) {
    redirect('/admin')
  }

  const payload = await getPayload({ config })
  const categoryResult = await payload.find({
    collection: 'doctor-categories',
    limit: 200,
    sort: 'name',
    depth: 1,
    overrideAccess: true,
  })
  const categories = categoryResult.docs as AdminCategory[]

  return (
    <AdminCategoriesScreen
      admin={{ id: admin.id, name: admin.name ?? null, email: admin.email }}
      initialCategories={categories}
    />
  )
}
