// app/verify-email/page.tsx
import { AuthApi } from "@/lib/api/auth"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle } from "lucide-react"
import Link from "next/link"

// В Next.js 15+ searchParams — это Promise, в Next.js 14 — обычный объект
interface VerifyEmailPageProps {
  searchParams: Promise<{ token?: string }> | { token?: string }
}

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  // Унифицированная работа с searchParams для Next.js 14 и 15
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
        message: err instanceof Error ? err.message : "Не удалось подтвердить email." 
      }
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-sm p-8 flex flex-col items-center gap-6 text-center">
        
        {result.success ? (
          <>
            <CheckCircle className="w-12 h-12 text-green-500" />
            <div className="flex flex-col gap-1">
              <p className="text-xl font-semibold text-foreground">Email подтверждён</p>
              <p className="text-sm text-muted-foreground">
                Ваш аккаунт активирован. Теперь вы можете войти.
              </p>
            </div>
            <Link href={"/"} className="w-full">
              Перейти на главную
            </Link>
          </>
        ) : (
          <>
            <XCircle className="w-12 h-12 text-destructive" />
            <div className="flex flex-col gap-1">
              <p className="text-xl font-semibold text-foreground">Ошибка подтверждения</p>
              <p className="text-sm text-muted-foreground">
                {result.message || "Ссылка устарела или недействительна."}
              </p>
            </div>
            <Button variant="outline" className="w-full" onClick={() => window.location.href = "/"}>
              На главную
            </Button>
          </>
        )}
        
      </div>
    </main>
  )
}