"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUserStore } from "@/stores/user-store"
import { CalendarX } from "lucide-react"

export function LkContent() {
  const router = useRouter()
  const { user, loading, fetched, fetchUser } = useUserStore()

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  useEffect(() => {
    if (fetched && !user) {
      router.replace("/")
    }
  }, [fetched, user, router])

  if (!fetched || loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="flex-1">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <p className="text-sm text-muted-foreground">Личный кабинет</p>
          <h1 className="text-2xl font-semibold text-foreground mt-1">
            {user.name || user.email}
          </h1>
          <p className="text-muted-foreground mt-1">{user.email}</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-8 flex flex-col items-center justify-center text-center gap-4">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
            <CalendarX className="w-7 h-7 text-muted-foreground" />
          </div>
          <div>
            <p className="text-lg font-medium text-foreground">
              У вас нет записей
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Запишитесь на прием к специалисту на главной странице
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
