"use client"

import React, { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { AuthApi } from "@/lib/api/auth"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle, XCircle } from "lucide-react"

type Status = "loading" | "success" | "error"

export default function VerifyEmailPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<Status>("loading")
  const [message, setMessage] = useState("")

  useEffect(() => {
    const token = searchParams.get("token")

    if (!token) {
      setStatus("error")
      setMessage("Ссылка недействительна: токен не найден.")
      return
    }

    AuthApi.verifyEmail(token)
      .then(() => {
        setStatus("success")
      })
      .catch((err) => {
        setStatus("error")
        setMessage(err instanceof Error ? err.message : "Не удалось подтвердить email.")
      })
  }, [searchParams])

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-sm p-8 flex flex-col items-center gap-6 text-center">
        {status === "loading" && (
          <>
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <p className="text-muted-foreground">Подтверждаем ваш email...</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle className="w-12 h-12 text-green-500" />
            <div className="flex flex-col gap-1">
              <p className="text-xl font-semibold text-foreground">Email подтверждён</p>
              <p className="text-sm text-muted-foreground">
                Ваш аккаунт активирован. Теперь вы можете войти.
              </p>
            </div>
            <Button className="w-full" onClick={() => router.push("/")}>
              Перейти на главную
            </Button>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="w-12 h-12 text-destructive" />
            <div className="flex flex-col gap-1">
              <p className="text-xl font-semibold text-foreground">Ошибка подтверждения</p>
              <p className="text-sm text-muted-foreground">
                {message || "Ссылка устарела или недействительна."}
              </p>
            </div>
            <Button variant="outline" className="w-full" onClick={() => router.push("/")}>
              На главную
            </Button>
          </>
        )}
      </div>
    </main>
  )
}
