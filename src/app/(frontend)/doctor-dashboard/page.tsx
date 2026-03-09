import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { DoctorDashboardContent } from "@/components/doctor-dashboard-content"
import { serverApiFetch, AppointmentsApi } from "@/lib/api"
import type { ApiDoctor, ApiAppointment } from "@/lib/api/types"

export const metadata = {
  title: "Личный кабинет врача | smartcardio",
  description: "Личный кабинет врача на платформе smartcardio Телемедицина",
}

export const dynamic = "force-dynamic"

interface DoctorMeResponse {
  user: ApiDoctor | null
}

export default async function DoctorDashboardPage() {
  const requestHeaders = await headers()
  const cookie = requestHeaders.get("cookie") ?? ""

  let doctor: ApiDoctor | null = null
  let appointments: ApiAppointment[] = []

  try {
    const data = await serverApiFetch<DoctorMeResponse>("/api/doctors/me", {
      cookie,
      cache: "no-store",
    })
    doctor = data.user ?? null

    if (doctor) {
      appointments = await AppointmentsApi.fetchDoctorAppointmentsServer({ cookie })
    }
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error
    doctor = null
  }

  if (!doctor) {
    redirect("/")
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <DoctorDashboardContent 
        userName={doctor.name || doctor.email} 
        appointments={appointments}
      />
      <Footer />
    </div>
  )
}
