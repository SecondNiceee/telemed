import { Header } from "@/components/header"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { serverApiFetch, AppointmentsApi } from "@/lib/api"
import type { ApiAppointment } from "@/lib/api/types"
import { ChatPage } from "@/components/chat/chat-page"
import type { User } from "@/payload-types"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Сообщения | Личный кабинет",
  description: "Чат с вашими врачами",
}

interface UserMeResponse {
  user: User | null
}

export default async function LkChatPage({
  searchParams,
}: {
  searchParams: Promise<{ appointment?: string }>
}) {
  const params = await searchParams
  const initialAppointmentId = params.appointment ? parseInt(params.appointment, 10) : null
  
  const requestHeaders = await headers()
  const cookie = requestHeaders.get("cookie") ?? ""

  let user: User | null = null
  let appointments: ApiAppointment[] = []

  try {
    // Fetch user
    const userData = await serverApiFetch<UserMeResponse>("/api/users/me", {
      cookie,
      cache: "no-store",
    })
    user = userData.user ?? null

    if (!user) {
      redirect("/")
    }

    // Fetch appointments
    appointments = await AppointmentsApi.fetchAppointmentsServer({ cookie })
  } catch (e) {
    // redirect() throws a special Next.js error — rethrow it
    if (e && typeof e === "object" && "digest" in e) throw e
    console.error(e)
    redirect("/")
  }

  // Filter to only confirmed/completed appointments (active chats)
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
