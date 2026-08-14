import { NextRequest, NextResponse } from 'next/server'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { getAdminFromCookieHeader } from '@/lib/auth/adminSession'

/** Удаление организации из панели. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminFromCookieHeader(req.headers.get('cookie') || '')
  if (!admin) {
    return NextResponse.json({ message: 'Требуется вход администратора' }, { status: 401 })
  }

  try {
    const { id } = await params
    const payload = await getPayload({ config: configPromise })

    await payload.delete({
      collection: 'organisations',
      id,
      overrideAccess: true,
    })

    return NextResponse.json({ message: 'Организация удалена' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Не удалось удалить организацию'
    return NextResponse.json({ message }, { status: 400 })
  }
}
