import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getAdminFromCookieHeader } from '@/lib/auth/adminSession'
import { AdminRequisitesScreen } from '@/components/admin/admin-requisites-screen'
import type { RequisitesFormValues } from '@/components/admin/admin-requisites-form'

export const metadata = {
  title: 'Реквизиты оператора',
  description: 'Реквизиты юрлица платформы для юридических документов',
}

export const dynamic = 'force-dynamic'

export default async function AdminRequisitesPage() {
  const requestHeaders = await headers()

  // Доступ только администратору. Без сессии возвращаем на экран входа /admin.
  const admin = await getAdminFromCookieHeader(requestHeaders.get('cookie') || '')
  if (!admin) {
    redirect('/admin')
  }

  // Читаем напрямую, а не через fetchOperatorRequisitesCached: форме нужны
  // сырые значения (пустая строка вместо «___»), иначе плейсхолдер попал бы
  // в поле ввода и при сохранении ушёл в БД как настоящее значение.
  const payload = await getPayload({ config })
  const settings = await payload.findGlobal({ slug: 'site-settings', depth: 0 })
  const operator = settings.operator ?? {}

  const initialValues: RequisitesFormValues = {
    legalName: operator.legalName ?? '',
    inn: operator.inn ?? '',
    ogrn: operator.ogrn ?? '',
    address: operator.address ?? '',
    email: operator.email ?? '',
    phone: operator.phone ?? '',
    hostingLocation: operator.hostingLocation ?? '',
    rknNotificationSubmitted: operator.rknNotificationSubmitted === true,
  }

  return (
    <AdminRequisitesScreen
      admin={{ id: admin.id, name: admin.name ?? null, email: admin.email }}
      initialValues={initialValues}
    />
  )
}
