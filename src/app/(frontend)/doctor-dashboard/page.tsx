import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getPayload } from "payload"
import config from "@payload-config"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { DoctorDashboardContent } from "@/components/doctor-dashboard-content"

export const metadata = {
  title: "Личный кабинет врача | smartcardio",
  description: "Личный кабинет врача на платформе smartcardio Телемедицина",
}

export default async function DoctorDashboardPage() {
  const payload = await getPayload({ config })
  const requestHeaders = await headers()

  let user = null
  try {
    const authResult = await payload.auth({ headers: requestHeaders })
    user = authResult.user
  } catch {
    redirect("/")
  }

  if (!user || (user.role !== "doctor" && user.role !== "admin")) {
    redirect("/")
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <DoctorDashboardContent userName={user.name || user.email} />
      <Footer />
    </div>
  )
}
