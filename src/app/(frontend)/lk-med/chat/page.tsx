import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getBaseUrl } from "@/lib/api/fetch"
import { getSessionFromCookie } from "@/lib/auth/getSessionFromCookie"
import type { ApiDoctor, ApiAppointment, PayloadListResponse } from "@/lib/api/types"
import { ChatPage } from "@/components/chat/chat-page"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Сообщения | Кабинет врача",
  description: "Чат с пациентами",
}

export default async function LkMedChatPage() {
  const requestHeaders = await headers()

  // Check doctors-token cookie for doctor auth on server
  const doctor = await getSessionFromCookie<ApiDoctor>(
    requestHeaders,
    "doctors-token",
    "doctors"
  )

  if (!doctor) {
    redirect("/lk-med")
  }

  // Fetch doctor's appointments
  let appointments: ApiAppointment[] = []
  try {
    const cookie = requestHeaders.get("cookie") ?? ""
    const baseUrl = getBaseUrl()

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
    console.error("Failed to fetch appointments:", e)
  }

  // Filter to only confirmed/completed appointments (active chats)
  const activeAppointments = appointments.filter(
    (a) => a.status === "confirmed" || a.status === "completed"
  )

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Link
              href="/lk-med"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Кабинет врача</span>
            </Link>
            <div className="h-4 w-px bg-border hidden sm:block" />
            <h1 className="font-semibold text-foreground">Сообщения</h1>
          </div>
          <div className="text-sm text-muted-foreground">
            {doctor.name || doctor.email}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <ChatPage
          appointments={activeAppointments}
          currentSenderType="doctor"
          currentSenderId={doctor.id}
        />
      </main>
    </div>
  )
}
