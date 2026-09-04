import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getAdminFromCookieHeader } from '@/lib/auth/adminSession'
import { AdminInboxScreen } from '@/components/admin/inbox/admin-inbox-screen'
import type { InboxConversation } from '@/components/admin/inbox/types'
import type { SupportMessage } from '@/payload-types'

export const metadata = {
  title: 'Обращения с сайта',
  description: 'Инбокс оператора: вопросы посетителей сайта и ответы на них',
}

export const dynamic = 'force-dynamic'

export default async function AdminInboxPage() {
  const requestHeaders = await headers()

  // Доступ только администратору. Без сессии возвращаем на экран входа /admin.
  const admin = await getAdminFromCookieHeader(requestHeaders.get('cookie') || '')
  if (!admin) {
    redirect('/admin')
  }

  const payload = await getPayload({ config })

  // Первый экран рендерим на сервере, чтобы список был виден сразу, до
  // установления сокет-соединения. Дальше обновления приходят по сокету.
  const conversationResult = await payload.find({
    collection: 'support-conversations',
    limit: 100,
    sort: '-lastMessageAt',
    depth: 0,
    overrideAccess: true,
  })

  // Превью последнего сообщения — одним запросом на все диалоги, а не N+1:
  // при сотне обращений это была бы сотня обращений к БД на каждый рендер.
  const conversationIds = conversationResult.docs.map((doc) => doc.id)
  const previews = new Map<number, SupportMessage>()

  if (conversationIds.length > 0) {
    const messageResult = await payload.find({
      collection: 'support-messages',
      where: { conversation: { in: conversationIds } },
      // Берём с запасом и раскладываем по диалогам на нашей стороне:
      // «последнее сообщение в каждой группе» одним запросом Payload не умеет.
      limit: 1000,
      sort: '-createdAt',
      depth: 0,
      overrideAccess: true,
    })

    for (const message of messageResult.docs) {
      const conversationId =
        typeof message.conversation === 'object' && message.conversation !== null
          ? message.conversation.id
          : message.conversation
      // sort по убыванию: первое встреченное для диалога и есть последнее.
      if (typeof conversationId === 'number' && !previews.has(conversationId)) {
        previews.set(conversationId, message)
      }
    }
  }

  const conversations: InboxConversation[] = conversationResult.docs.map((doc) => {
    const preview = previews.get(doc.id)
    return {
      publicId: doc.publicId,
      visitorName: doc.visitorName,
      status: doc.status,
      lastMessageAt: doc.lastMessageAt ?? null,
      operatorReadAt: doc.operatorReadAt ?? null,
      pageUrl: doc.pageUrl ?? null,
      createdAt: doc.createdAt,
      lastMessagePreview: preview ? preview.text.slice(0, 160) : null,
      lastMessageSender: preview ? preview.sender : null,
    }
  })

  return (
    <AdminInboxScreen
      admin={{ id: admin.id, name: admin.name ?? null, email: admin.email }}
      initialConversations={conversations}
    />
  )
}
