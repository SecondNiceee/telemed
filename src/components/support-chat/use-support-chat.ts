'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'

export interface SupportMessageDto {
  id: number
  sender: 'visitor' | 'operator'
  text: string
  createdAt: string
}

interface SupportAck {
  success: boolean
  error?: string
  publicId?: string
  messages?: SupportMessageDto[]
}

/**
 * Ключ в localStorage. Хранит publicId — он же токен доступа к переписке,
 * поэтому именно localStorage, а не cookie: на сервер его отправляет только
 * наш код, и то через сокет.
 */
const STORAGE_KEY = 'smartcardio:support:publicId'

function readStoredId(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    // Приватный режим Safari умеет бросать на localStorage — тогда просто
    // работаем без истории между перезагрузками.
    return null
  }
}

function writeStoredId(publicId: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, publicId)
  } catch {
    /* см. readStoredId */
  }
}

function clearStoredId(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* см. readStoredId */
  }
}

/** Есть ли у посетителя начатый диалог — решает, поднимать ли сокет заранее. */
export function hasStoredConversation(): boolean {
  return readStoredId() !== null
}

/**
 * Состояние чата поддержки.
 *
 * `enabled` включается, когда виджет открыли впервые: сокет не поднимается
 * на каждой странице ради кнопки, которую могут не нажать. Соединение
 * создаётся лениво и живёт до размонтирования.
 */
export function useSupportChat(enabled: boolean) {
  const [messages, setMessages] = useState<SupportMessageDto[]>([])
  const [publicId, setPublicId] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Пока история не загружена, форму показывать рано: иначе вернувшийся
  // посетитель на миг увидит пустую форму вместо своей переписки.
  const [isRestoring, setIsRestoring] = useState(false)
  // Ответ оператора пришёл, пока панель закрыта. Число не считаем — точки
  // на кнопке достаточно, а пересчёт при переподключении сделал бы его
  // ненадёжным (см. UnreadDot).
  const [hasUnread, setHasUnread] = useState(false)

  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!enabled || socketRef.current) return

    const baseUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001'
    const socketPath = process.env.NEXT_PUBLIC_SOCKET_PATH || '/socket.io'

    const socket = io(`${baseUrl}/support`, {
      path: socketPath,
      transports: ['websocket', 'polling'],
      withCredentials: true,
    })
    socketRef.current = socket

    const stored = readStoredId()
    if (stored) setIsRestoring(true)

    socket.on('connect', () => {
      setIsConnected(true)
      setError(null)

      // Комнаты не переживают переподключение (сокету выдаётся новый id),
      // поэтому resume нужен и при первом входе, и после каждого обрыва.
      const saved = readStoredId()
      if (!saved) {
        setIsRestoring(false)
        return
      }

      socket.emit('support:resume', { publicId: saved }, (ack: SupportAck) => {
        setIsRestoring(false)
        if (ack?.success && ack.publicId) {
          setPublicId(ack.publicId)
          setMessages(ack.messages ?? [])
        } else {
          // Диалог не найден — например, его удалили в админке.
          // Начинаем заново, чтобы посетитель не застрял в пустом чате.
          clearStoredId()
          setPublicId(null)
          setMessages([])
        }
      })
    })

    socket.on('disconnect', () => setIsConnected(false))

    socket.on('connect_error', () => {
      setIsConnected(false)
      setIsRestoring(false)
      setError('Нет связи с сервером')
    })

    socket.on('support:message', (message: SupportMessageDto) => {
      setMessages((previous) => {
        // Сообщение может прийти дважды: своё эхо плюс повторная доставка.
        if (previous.some((item) => item.id === message.id)) return previous
        // Флаг ставим только на действительно новое сообщение оператора;
        // виджет сам снимет его, если панель сейчас открыта.
        if (message.sender === 'operator') setHasUnread(true)
        return [...previous, message]
      })
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [enabled])

  /** Первое сообщение: создаёт диалог и тему в Telegram. */
  const start = useCallback(
    (text: string) => {
      return new Promise<boolean>((resolve) => {
        const socket = socketRef.current
        if (!socket?.connected) {
          setError('Нет связи с сервером')
          resolve(false)
          return
        }

        setIsBusy(true)
        setError(null)

        socket.emit(
          'support:start',
          { text, pageUrl: window.location.href },
          (ack: SupportAck) => {
            setIsBusy(false)
            if (ack?.success && ack.publicId) {
              writeStoredId(ack.publicId)
              setPublicId(ack.publicId)
              setMessages(ack.messages ?? [])
              resolve(true)
            } else {
              setError(ack?.error || 'Не удалось отправить вопрос')
              resolve(false)
            }
          },
        )
      })
    },
    [],
  )

  /**
   * Отправить сообщение.
   *
   * Виджету всё равно, первое оно или нет: пока диалога нет — создаём его
   * этим же текстом, дальше — дописываем в существующий. Так поле ввода
   * одно и то же с первой секунды, без отдельной «формы первого обращения».
   */
  const send = useCallback(
    (text: string) => {
      if (!publicId) return start(text)

      return new Promise<boolean>((resolve) => {
        const socket = socketRef.current
        if (!socket?.connected) {
          setError('Нет связи с сервером')
          resolve(false)
          return
        }

        setIsBusy(true)
        setError(null)

        // Локальную копию не добавляем: сообщение придёт эхом от сервера.
        // Так порядок и идентификаторы одинаковы во всех вкладках.
        socket.emit('support:send', { publicId, text }, (ack: SupportAck) => {
          setIsBusy(false)
          if (ack?.success) {
            resolve(true)
          } else {
            setError(ack?.error || 'Не удалось отправить сообщение')
            resolve(false)
          }
        })
      })
    },
    [publicId, start],
  )

  const markRead = useCallback(() => setHasUnread(false), [])

  return {
    messages,
    hasConversation: publicId !== null,
    isConnected,
    isBusy,
    isRestoring,
    error,
    hasUnread,
    markRead,
    send,
  }
}
