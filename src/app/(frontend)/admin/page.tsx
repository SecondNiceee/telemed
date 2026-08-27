import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { AdminPanel } from '@/components/admin/admin-panel'
import { getAdminFromCookieHeader, hasAnyUser } from '@/lib/auth/adminSession'
import type { AdminOrganisation } from '@/components/admin/types'

export const metadata = {
  title: 'Панель управления',
  description: 'Управление организациями платформы smartcardio',
}

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const requestHeaders = await headers()

  let needsSetup = false
  let admin: Awaited<ReturnType<typeof getAdminFromCookieHeader>> = null
  // Данные грузим на сервере, чтобы панель открывалась уже заполненной.
  let organisations: AdminOrganisation[] = []

  try {
    // Пустая база => показываем экран первичной настройки, вход не нужен.
    needsSetup = !(await hasAnyUser())
    admin = needsSetup
      ? null
      : await getAdminFromCookieHeader(requestHeaders.get('cookie') || '')

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
  } catch (err) {
    // Чаще всего это отсутствующие PAYLOAD_SECRET / DATABASE_URL — показываем
    // причину текстом, иначе страница падает с безымянной 500.
    return <AdminUnavailable message={err instanceof Error ? err.message : String(err)} />
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

/** Экран, когда Payload не смог подняться: без БД панель работать не может. */
function AdminUnavailable({ message }: { message: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-md">
        <p className="text-xs font-medium uppercase tracking-widest text-destructive">
          Панель недоступна
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground text-balance">
          Не удалось подключиться к базе данных
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
          Проверьте переменные окружения <span className="font-mono">DATABASE_URL</span> и{' '}
          <span className="font-mono">PAYLOAD_SECRET</span>, затем перезапустите приложение.
        </p>
        <pre className="mt-6 rounded-lg border border-border bg-muted/40 p-4 text-xs text-muted-foreground whitespace-pre-wrap break-words">
          {message}
        </pre>
      </div>
    </main>
  )
}
