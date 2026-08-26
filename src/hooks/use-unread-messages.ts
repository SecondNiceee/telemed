'use client'

import { useChatStore } from '@/stores/chat-store'

/**
 * Есть ли непрочитанные сообщения по консультации — для точки на кнопке чата
 * в кабинетах (/lk, /lk-med).
 *
 * Данные приходят из двух источников, и приоритет между ними важен:
 *
 * - `initialCounts` — снимок из БД, сделанный при серверном рендере страницы.
 *   Только он работает при полной загрузке: chat-store живёт в памяти и после
 *   перезагрузки всегда пустой, поэтому раньше точки/бейджи появлялись лишь
 *   после прихода живого события.
 * - chat-store — живое состояние: сокет увеличивает счётчик при новом
 *   сообщении, а открытие чата обнуляет его.
 *
 * Store главнее снимка, но только там, где у него есть запись по этой
 * консультации. Иначе прочитанный в этой же сессии чат снова получал бы точку
 * при возврате в кабинет: клиентская навигация может отдать закешированный
 * серверный ответ, снятый до прочтения.
 */
export function useUnreadMessages(initialCounts: Record<number, number>) {
  const liveCounts = useChatStore((state) => state.unreadCounts)

  const hasUnread = (appointmentId: number): boolean => {
    const live = liveCounts[appointmentId]
    if (live !== undefined) return live > 0
    return (initialCounts[appointmentId] ?? 0) > 0
  }

  const appointmentIds = new Set([
    ...Object.keys(initialCounts).map(Number),
    ...Object.keys(liveCounts).map(Number),
  ])
  const hasAnyUnread = [...appointmentIds].some((id) => hasUnread(id))

  return { hasUnread, hasAnyUnread }
}
