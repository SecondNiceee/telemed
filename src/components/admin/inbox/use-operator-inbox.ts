'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { playChime, setUnreadTitle } from './inbox-notify'
import { isUnread } from './types'
import type { InboxConversation, InboxMessage } from './types'

interface OperatorAck {
  success: boolean
  error?: string
  conversations?: InboxConversation[]
  messages?: InboxMessage[]
  conversation?: InboxConversation
}

/** Свежие сверху. Диалоги без сообщений уходят в конец. */
function byRecency(a: InboxConversation, b: InboxConversation): number {
  const left = a.lastMessageAt ?? a.createdAt
  const right = b.lastMessageAt ?? b.createdAt
  return new Date(right).getTime() - new Date(left).getTime()
}

function upsert(
  list: InboxConversation[],
  conversation: InboxConversation,
): InboxConversation[] {
  const exists = list.some((item) => item.publicId === conversation.publicId)
  // Без Array.prototype.with: цель сборки ES2022, а в старых Safari его нет.
  const next = exists
    ? list.map((item) => (item.publicId === conversation.publicId ? conversation : item))
    : [...list, conversation]
  return next.sort(byRecency)
}

/**
 * Состояние инбокса оператора.
 *
 * Работает в том же namespace `/support`, что и виджет посетителя, но по
 * операторским событиям: права проверяются на сервере при каждом вызове по
 * cookie `payload-token`.
 */
export function useOperatorInbox(initial: InboxConversation[]) {
  const [conversations, setConversations] = useState<InboxConversation[]>(() =>
    [...initial].sort(byRecency),
  )
  const [openId, setOpenId] = useState<string | null>(null)
  const [messages, setMessages] = useState<InboxMessage[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isLoadingThread, setIsLoadingThread] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const socketRef = useRef<Socket | null>(null)
  // Открытый диалог нужен внутри обработчиков сокета, которые ставятся один
  // раз: через ref, иначе пришлось бы пересоздавать соединение на каждый выбор.
  const openIdRef = useRef<string | null>(null)
  openIdRef.current = openId

  const unreadCount = useMemo(
    () => conversations.filter(isUnread).length,
    [conversations],
  )

  useEffect(() => {
    setUnreadTitle(unreadCount)
    return () => setUnreadTitle(0)
  }, [unreadCount])

  useEffect(() => {
    const baseUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001'
    const socketPath = process.env.NEXT_PUBLIC_SOCKET_PATH || '/socket.io'

    const socket = io(`${baseUrl}/support`, {
      path: socketPath,
      transports: ['websocket', 'polling'],
      withCredentials: true,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setError(null)

      // Комнату операторов сокет теряет при каждом переподключении, поэтому
      // join нужен и при первом входе, и после любого обрыва связи.
      socket.emit('support:operator:join', (ack: OperatorAck) => {
        if (ack?.success) {
          setIsConnected(true)
          setConversations([...(ack.conversations ?? [])].sort(byRecency))
        } else {
          setIsConnected(false)
          setError(ack?.error || 'Не удалось подключиться к обращениям')
        }
      })
    })

    socket.on('disconnect', () => setIsConnected(false))

    socket.on('connect_error', () => {
      setIsConnected(false)
      setError('Нет связи с сервером')
    })

    // Написал посетитель — обновляем список, звоним и, если диалог открыт,
    // сразу дописываем сообщение в переписку.
    socket.on(
      'support:operator:incoming',
      ({
        conversation,
        message,
      }: {
        conversation: InboxConversation
        message: InboxMessage
      }) => {
        setConversations((previous) => upsert(previous, conversation))

        if (openIdRef.current === conversation.publicId) {
          setMessages((previous) =>
            previous.some((item) => item.id === message.id)
              ? previous
              : [...previous, message],
          )
        }

        playChime()
      },
    )

    // Служебное обновление (свой ответ, снятая отметка, смена статуса) —
    // молча, без звука.
    socket.on(
      'support:operator:sync',
      ({
        conversation,
        message,
      }: {
        conversation: InboxConversation
        message?: InboxMessage
      }) => {
        setConversations((previous) => upsert(previous, conversation))

        if (message && openIdRef.current === conversation.publicId) {
          setMessages((previous) =>
            previous.some((item) => item.id === message.id)
              ? previous
              : [...previous, message],
          )
        }
      },
    )

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  const open = useCallback((publicId: string) => {
    const socket = socketRef.current
    if (!socket?.connected) {
      setError('Нет связи с сервером')
      return
    }

    setOpenId(publicId)
    openIdRef.current = publicId
    setMessages([])
    setIsLoadingThread(true)

    socket.emit('support:operator:open', { publicId }, (ack: OperatorAck) => {
      setIsLoadingThread(false)
      if (ack?.success) {
        setMessages(ack.messages ?? [])
        if (ack.conversation) {
          setConversations((previous) => upsert(previous, ack.conversation as InboxConversation))
        }
      } else {
        setError(ack?.error || 'Не удалось загрузить переписку')
      }
    })
  }, [])

  const reply = useCallback(
    (text: string) => {
      return new Promise<boolean>((resolve) => {
        const socket = socketRef.current
        const publicId = openIdRef.current
        if (!socket?.connected || !publicId) {
          setError('Нет связи с сервером')
          resolve(false)
          return
        }

        setIsSending(true)
        setError(null)

        // Локальную копию не добавляем: сообщение вернётся событием sync,
        // как и в виджете посетителя. Один источник истины — сервер.
        socket.emit('support:operator:reply', { publicId, text }, (ack: OperatorAck) => {
          setIsSending(false)
          if (ack?.success) {
            resolve(true)
          } else {
            setError(ack?.error || 'Не удалось отправить ответ')
            resolve(false)
          }
        })
      })
    },
    [],
  )

  const setStatus = useCallback((publicId: string, status: 'open' | 'closed') => {
    const socket = socketRef.current
    if (!socket?.connected) {
      setError('Нет связи с сервером')
      return
    }

    socket.emit('support:operator:status', { publicId, status }, (ack: OperatorAck) => {
      if (!ack?.success) setError(ack?.error || 'Не удалось изменить статус')
    })
  }, [])

  const openConversation = useMemo(
    () => conversations.find((item) => item.publicId === openId) ?? null,
    [conversations, openId],
  )

  return {
    conversations,
    openConversation,
    messages,
    unreadCount,
    isConnected,
    isLoadingThread,
    isSending,
    error,
    open,
    reply,
    setStatus,
    dismissError: useCallback(() => setError(null), []),
  }
}
