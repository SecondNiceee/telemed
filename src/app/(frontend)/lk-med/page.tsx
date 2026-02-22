import { headers } from "next/headers"
import { Footer } from "@/components/footer"
import { LkMedContent } from "@/components/lk-med-content"
import { getSessionFromCookie } from "@/lib/auth/getSessionFromCookie"
import type { ApiDoctor } from "@/lib/api/types"

export const metadata = {
  title: "Кабинет врача | smartcardio",
  description: "Личный кабинет врача на платформе smartcardio Телемедицина",
}

export default async function LkMedPage() {
  const requestHeaders = await headers()

  // Check doctors-token cookie for doctor auth on server
  const doctor = await getSessionFromCookie<ApiDoctor>(
    requestHeaders,
    'doctors-token',
    'doctors',
  )

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <LkMedContent initialDoctor={doctor} />
      <Footer />
    </div>
  )
}
