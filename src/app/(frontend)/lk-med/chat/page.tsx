import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { serverApiFetch, AppointmentsApi } from "@/lib/api"
import type { ApiDoctor, ApiAppointment } from "@/lib/api/types"
import { ChatPage } from "@/components/chat/chat-page"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Сообщения | Кабинет врача",
  description: "Чат с пациентами",
}

interface DoctorMeResponse {
  user: ApiDoctor | null
}

export default async function LkMedChatPage({
  searchParams,
}: {
  searchParams: Promise<{ appointment?: string }>
}) {
  const params = await searchParams
  const initialAppointmentId = params.appointment ? parseInt(params.appointment, 10) : null
  
  const requestHeaders = await headers()
  const cookie = requestHeaders.get("cookie") ?? ""

  let doctor: ApiDoctor | null = null
  let appointments: ApiAppointment[] = []

  try {
    // Fetch doctor
    const doctorData = await serverApiFetch<DoctorMeResponse>("/api/doctors/me", {
      cookie,
      cache: "no-store",
    })
    doctor = doctorData.user ?? null

    if (!doctor) {
      redirect("/lk-med/login")
    }

    // Fetch appointments
    appointments = await AppointmentsApi.fetchDoctorAppointmentsServer({ cookie })
  } catch (e) {
    // redirect() throws a special Next.js error — rethrow it
    if (e && typeof e === "object" && "digest" in e) throw e
    console.error(e)
    redirect("/lk-med/login")
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
          initialAppointmentId={initialAppointmentId}
        />
      </main>
    </div>
  )
}
