'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

/**
 * Ключ в localStorage — здесь он уместен: это не пользовательские данные, а
 * отметка «уведомление уже показано», которая должна жить только в браузере.
 * Версия в ключе позволяет показать плашку заново, если текст поменяется.
 */
const STORAGE_KEY = 'cookie-notice-dismissed:v1'

/**
 * Информационная плашка про cookie.
 *
 * На сайте нет счётчиков и рекламных cookie — только технические cookie
 * сессии, без которых вход не работает. Поэтому кнопки «отказаться» нет:
 * отказаться от них нельзя, не отказавшись от сервиса. Плашка только
 * уведомляет и ведёт на раздел политики с перечнем cookie и localStorage.
 *
 * Показывается после монтирования, чтобы не расходиться с SSR-разметкой.
 */
export function CookieNotice() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) setVisible(true)
    } catch {
      // Приватный режим без localStorage — показываем каждый раз, это безопасно.
      setVisible(true)
    }
  }, [])

  const dismiss = () => {
    setVisible(false)
    try {
      window.localStorage.setItem(STORAGE_KEY, new Date().toISOString())
    } catch {
      // Не удалось запомнить — покажем при следующем визите.
    }
  }

  if (!visible) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 left-5 z-40 flex max-w-[calc(100vw-7rem)] items-start gap-2 rounded-lg border border-border bg-card/95 px-3 py-2 text-xs leading-relaxed text-muted-foreground shadow-md backdrop-blur sm:max-w-sm"
    >
      <p className="text-pretty">
        Сайт использует только технические cookie, необходимые для входа и работы
        сервиса.{' '}
        <a
          // Якорь на раздел про cookie, а не на начало политики: человек кликает
          // именно про cookie и должен сразу увидеть их перечень. Открываем в
          // новой вкладке, чтобы не уводить со страницы, на которой он был.
          href="/legal/privacy#cookies"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground"
        >
          Подробнее
          <span className="sr-only"> (откроется в новой вкладке)</span>
        </a>
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Закрыть уведомление о cookie"
        className="-mr-1 -mt-0.5 shrink-0 rounded p-1 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  )
}
