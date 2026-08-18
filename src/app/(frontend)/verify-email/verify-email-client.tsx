'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, XCircle, Mail, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { AuthApi } from '@/lib/api/auth'
import { useUserStore } from '@/stores/user-store'

type Status = 'loading' | 'success' | 'error'

export function VerifyEmailClient({ token }: { token?: string }) {
  const setUser = useUserStore((state) => state.setUser)
  const [status, setStatus] = useState<Status>(token ? 'loading' : 'error')
  const [message, setMessage] = useState<string>(
    token ? '' : 'Ссылка недействительна: токен не найден.',
  )
  // React в dev (StrictMode) монтирует эффект дважды — не даём подтвердить
  // токен повторно, иначе второй запрос упадёт «токен уже использован».
  const startedRef = useRef(false)

  useEffect(() => {
    if (!token || startedRef.current) return
    startedRef.current = true

    let isMounted = true

    void (async () => {
      try {
        const { user } = await AuthApi.verifyEmail(token)
        if (!isMounted) return
        // Роут уже выдал cookie сессии — синхронизируем стор, чтобы шапка
        // сразу показала аккаунт вместо кнопки «Войти».
        if (user) setUser(user)
        setStatus('success')
      } catch (err) {
        if (!isMounted) return
        setMessage(err instanceof Error ? err.message : 'Не удалось подтвердить email.')
        setStatus('error')
      }
    })()

    return () => {
      isMounted = false
    }
  }, [token, setUser])

  const isSuccess = status === 'success'
  const isLoading = status === 'loading'

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      {/* subtle background accent */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* card */}
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          {/* top stripe */}
          <div
            className={`h-1 w-full ${
              isLoading ? 'bg-primary/40' : isSuccess ? 'bg-primary' : 'bg-destructive'
            }`}
          />

          <div className="flex flex-col items-center gap-5 px-8 py-10 text-center">
            {/* icon ring */}
            <div
              className={`flex items-center justify-center w-16 h-16 rounded-full ${
                isLoading
                  ? 'bg-primary/10 text-primary'
                  : isSuccess
                    ? 'bg-primary/10 text-primary'
                    : 'bg-destructive/10 text-destructive'
              }`}
            >
              {isLoading ? (
                <Loader2 className="w-8 h-8 animate-spin" strokeWidth={1.75} aria-hidden="true" />
              ) : isSuccess ? (
                <CheckCircle2 className="w-8 h-8" strokeWidth={1.75} />
              ) : (
                <XCircle className="w-8 h-8" strokeWidth={1.75} />
              )}
            </div>

            {/* text */}
            <div className="flex flex-col gap-1.5">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                {isLoading
                  ? 'Подтверждаем email…'
                  : isSuccess
                    ? 'Email подтверждён'
                    : 'Ошибка подтверждения'}
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {isLoading
                  ? 'Пожалуйста, подождите — активируем ваш аккаунт.'
                  : isSuccess
                    ? 'Ваш аккаунт успешно активирован. Вы уже вошли — можно пользоваться всеми возможностями.'
                    : message || 'Ссылка устарела или недействительна.'}
              </p>
            </div>

            {/* divider */}
            <div className="w-full border-t border-border" />

            {/* action */}
            {isLoading ? (
              <Button className="w-full" disabled aria-busy="true">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Обновляем аккаунт…
              </Button>
            ) : isSuccess ? (
              <div className="flex flex-col gap-2 w-full">
                <Button asChild className="w-full">
                  <Link href="/">На главную</Link>
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 w-full">
                <Button asChild variant="outline" className="w-full">
                  <Link href="/">На главную</Link>
                </Button>
                <p className="text-xs text-muted-foreground">
                  Попробуйте запросить новое письмо с подтверждением через личный кабинет.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* footer note */}
        <p className="mt-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
          <Mail className="w-3.5 h-3.5" />
          Письмо отправлено автоматически системой
        </p>
      </div>
    </main>
  )
}
