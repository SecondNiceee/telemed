import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { DoctorDashboardContent } from "@/components/doctor-dashboard-content"
import { getSessionFromCookie } from "@/lib/auth/getSessionFromCookie"

export const metadata = {
  title: "Личный кабинет врача | smartcardio",
  description: "Личный кабинет врача на платформе smartcardio Телемедицина",
}

export default async function DoctorDashboardPage() {
  const requestHeaders = await headers()

  // Check doctors-token cookie for doctor auth
  const doctor = await getSessionFromCookie<{ id: number; name?: string; email: string }>(
    requestHeaders,
    'doctors-token',
    'doctors',
  )

  if (!doctor) {
    redirect("/")
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <DoctorDashboardContent userName={doctor.name || doctor.email} />
      <Footer />
    </div>
  )
}
