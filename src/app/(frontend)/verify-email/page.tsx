// app/verify-email/page.tsx
import { AuthApi } from "@/lib/api/auth"
import { Button } from "@/components/ui/button"
import { CheckCircle2, XCircle, Mail } from "lucide-react"
import Link from "next/link"

interface VerifyEmailPageProps {
  searchParams: Promise<{ token?: string }> | { token?: string }
}

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const params = await Promise.resolve(searchParams)
  const token = params.token

  let result: { success: boolean; message?: string } = { success: false }

  if (!token) {
    result = { success: false, message: "Ссылка недействительна: токен не найден." }
  } else {
    try {
      await AuthApi.verifyEmail(token)
      result = { success: true }
    } catch (err) {
      result = {
        success: false,
        message: err instanceof Error ? err.message : "Не удалось подтвердить email.",
      }
    }
  }

  const isSuccess = result.success

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      {/* subtle background accent */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* card */}
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          {/* top stripe */}
          <div className={`h-1 w-full ${isSuccess ? "bg-primary" : "bg-destructive"}`} />

          <div className="flex flex-col items-center gap-5 px-8 py-10 text-center">
            {/* icon ring */}
            <div
              className={`flex items-center justify-center w-16 h-16 rounded-full 
                ${isSuccess
                  ? "bg-primary/10 text-primary"
                  : "bg-destructive/10 text-destructive"
                }`}
            >
              {isSuccess ? (
                <CheckCircle2 className="w-8 h-8" strokeWidth={1.75} />
              ) : (
                <XCircle className="w-8 h-8" strokeWidth={1.75} />
              )}
            </div>

            {/* text */}
            <div className="flex flex-col gap-1.5">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                {isSuccess ? "Email подтверждён" : "Ошибка подтверждения"}
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {isSuccess
                  ? "Ваш аккаунт успешно активирован. Теперь вы можете войти и пользоваться всеми возможностями."
                  : (result.message || "Ссылка устарела или недействительна.")}
              </p>
            </div>

            {/* divider */}
            <div className="w-full border-t border-border" />

            {/* action */}
            {isSuccess ? (
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
