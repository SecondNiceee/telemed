import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { Footer } from "@/components/footer"
import { LkMedContent } from "@/components/lk-med-content"
import { serverApiFetch, AppointmentsApi } from "@/lib/api/index"
import type { ApiDoctor, ApiAppointment } from "@/lib/api/types"

export const metadata = {
  title: "Кабинет врача | smartcardio",
  description: "Личный кабинет врача на платформе smartcardio Телемедицина",
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

  try {
    // Make server-side request to /api/doctors/me with no caching
    const data = await serverApiFetch<DoctorMeResponse>("/api/doctors/me", {
      cookie,
      cache: "no-store",
    })
    doctor = data.user ?? null

    // If doctor is authenticated, fetch their appointments
    if (doctor) {
      appointments = await AppointmentsApi.fetchDoctorAppointmentsServer({ cookie })
    }
  } catch (error) {
    // If request fails, doctor is not authenticated
    // redirect() throws a special Next.js error — rethrow it
    console.log(error);
    if (error && typeof error === "object" && "digest" in error) throw error
    doctor = null
  }

  // Redirect to login if not authenticated
  if (!doctor) {
    console.log("Доктор был не найден")
    redirect("/lk-med/login")
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <LkMedContent initialDoctor={doctor} initialAppointments={appointments} />
      <Footer />
    </div>
  )
}
