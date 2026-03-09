import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { Footer } from "@/components/footer"
import { LkMedContent } from "@/components/lk-med-content"
import { serverApiFetch } from "@/lib/api"
import type { ApiDoctor } from "@/lib/api/types"

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

  try {
    // Make server-side request to /api/doctors/me with no caching
    const data = await serverApiFetch<DoctorMeResponse>("/api/doctors/me", {
      cookie,
      cache: "no-store",
    })
    doctor = data.user ?? null
  } catch (error) {
    // If request fails, doctor is not authenticated
    doctor = null
  }

  // Redirect to login if not authenticated
  if (!doctor) {
    redirect("/lk-med/login")
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <LkMedContent initialDoctor={doctor} />
      <Footer />
    </div>
  )
}
