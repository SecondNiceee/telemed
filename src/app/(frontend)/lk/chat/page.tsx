import { Header } from "@/components/header"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { getBaseUrl } from "@/lib/api/fetch"
import type { ApiAppointment, PayloadListResponse } from "@/lib/api/types"
import { ChatPage } from "@/components/chat/chat-page"
import type { User } from "@/payload-types"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Сообщения | Личный кабинет",
  description: "Чат с вашими врачами",
}

export default async function LkChatPage({
  searchParams,
}: {
  searchParams: Promise<{ appointment?: string }>
}) {
  const params = await searchParams
  const initialAppointmentId = params.appointment ? parseInt(params.appointment, 10) : null
  let user: User | null = null
  let appointments: ApiAppointment[] = []

  try {
    const hdrs = await headers()
    const cookie = hdrs.get("cookie") ?? ""
    const baseUrl = getBaseUrl()

    // Fetch user
    const userRes = await fetch(`${baseUrl}/api/users/me`, {
      headers: { cookie },
      cache: "no-store",
    })
    if (userRes.ok) {
      const data = await userRes.json()
      user = data.user ?? null
    }
    if (!user) {
      redirect("/")
    }

    // Fetch appointments (for chat list)
    const apptRes = await fetch(
      `${baseUrl}/api/appointments?limit=100&depth=1&sort=-date`,
      {
        headers: { cookie },
        cache: "no-store",
      }
    )
    if (apptRes.ok) {
      const data: PayloadListResponse<ApiAppointment> = await apptRes.json()
      appointments = data.docs
    }
  } catch (e) {
    // redirect() throws a special Next.js error — rethrow it
    if (e && typeof e === "object" && "digest" in e) throw e
    console.error(e)
    redirect("/")
  }

  // Filter to only confirmed appointments (active chats)
  const activeAppointments = appointments.filter(
    (a) => a.status === "confirmed" || a.status === "completed"
  )

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header />
      
      {/* Back link - mobile only */}
      <div className="md:hidden border-b border-border bg-card px-4 py-2">
        <Link 
          href="/lk" 
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Вернуться в кабинет
        </Link>
      </div>

      <main className="flex-1 overflow-hidden">
        <ChatPage
          appointments={activeAppointments}
          currentSenderType="user"
          currentSenderId={user.id}
          initialAppointmentId={initialAppointmentId}
        />
      </main>
    </div>
  )
}
