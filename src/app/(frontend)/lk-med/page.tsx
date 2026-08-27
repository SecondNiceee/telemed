import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { Footer } from "@/components/footer"
import { BackgroundDecor } from "@/components/background-decor"
import { LkMedContent } from "@/components/lk-med-content"
import { serverApiFetch, AppointmentsApi, MessagesApi } from "@/lib/api/index"
import type { ApiDoctor, ApiAppointment } from "@/lib/api/types"

export const metadata = {
  title: "Кабинет врача",
  description: "Личный кабинет врача на платформе smartcardio Видеоконсультация с врачом",
}

export const dynamic = "force-dynamic"

interface DoctorMeResponse {
  user: ApiDoctor | null
}

export default async function LkMedPage() {
  const requestHeaders = await headers()
  const cookie = requestHeaders.get("cookie") ?? ""

  let doctor: ApiDoctor | null = null
  let appointments: ApiAppointment[] = []
  // Непрочитанные из БД: chat-store живёт в памяти и на свежей загрузке пуст,
  // поэтому без снимка точка «новое сообщение» не появлялась бы вовсе.
  let unreadCounts: Record<number, number> = {}

  try {
    // Make server-side request to /api/doctors/me with no caching
    const data = await serverApiFetch<DoctorMeResponse>("/api/doctors/me", {
      cookie,
      cache: "no-store",
    })
    doctor = data.user ?? null

    // If doctor is authenticated, fetch their appointments - explicitly filter by doctor ID
    if (doctor) {
      appointments = await AppointmentsApi.fetchDoctorAppointmentsServer({ cookie, doctorId: doctor.id })
      unreadCounts = await MessagesApi.fetchUnreadCountsServer({ cookie, currentSenderType: "doctor" })
    }
  } catch (error) {
    // If request fails, doctor is not authenticated
    // redirect() throws a special Next.js error — rethrow it
    if (error && typeof error === "object" && "digest" in error) throw error
    doctor = null
  }

  // Redirect to login if not authenticated
  if (!doctor) {
    console.log("Доктор был не найден")
    redirect("/lk-med/login")
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Сквозной декор как на главной, но без линий ЭКГ (ecg={false}):
          в кабинете идёт плотный список консультаций, линии мешали бы чтению.
          Остаются точечная сетка и водяные знаки логотипа. */}
      <BackgroundDecor id="lk-med" position="fixed" ecg={false} />
      {/* Декор — fixed-элемент со своим z, поэтому контент поднимаем над ним. */}
      <div className="relative z-10 flex flex-1 flex-col">
        <LkMedContent
          initialDoctor={doctor}
          initialAppointments={appointments}
          initialUnreadCounts={unreadCounts}
        />
      </div>
      <Footer />
    </div>
  )
}
