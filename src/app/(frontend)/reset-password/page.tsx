// app/reset-password/page.tsx
import { Button } from "@/components/ui/button"
import { KeyRound, Mail, XCircle } from "lucide-react"
import Link from "next/link"
import { ResetPasswordForm } from "./reset-password-form"

interface ResetPasswordPageProps {
  searchParams: Promise<{ token?: string }> | { token?: string }
}

export const metadata = {
  title: "Восстановление пароля — smartcardio",
  description: "Создайте новый пароль для входа в личный кабинет smartcardio.",
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await Promise.resolve(searchParams)
  const token = params.token

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      {/* subtle background accent */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          {/* top stripe */}
          <div className={`h-1 w-full ${token ? "bg-primary" : "bg-destructive"}`} />

          <div className="px-8 py-10">
            {token ? (
              <div className="flex flex-col items-center gap-5">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary">
                  <KeyRound className="w-8 h-8" strokeWidth={1.75} />
                </div>
                <div className="w-full">
                  <ResetPasswordForm token={token} />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-5 text-center">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 text-destructive">
                  <XCircle className="w-8 h-8" strokeWidth={1.75} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <h1 className="text-xl font-semibold tracking-tight text-foreground">
                    Ссылка недействительна
                  </h1>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    В ссылке нет токена восстановления. Запросите новое письмо через «Забыли
                    пароль?» на главной странице.
                  </p>
                </div>
                <div className="w-full border-t border-border" />
                <Button asChild variant="outline" className="w-full">
                  <Link href="/">На главную</Link>
                </Button>
              </div>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
          <Mail className="w-3.5 h-3.5" />
          Ссылка из письма действительна 1 час
        </p>
      </div>
    </main>
  )
}
