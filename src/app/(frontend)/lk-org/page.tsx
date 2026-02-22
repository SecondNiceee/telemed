import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { LkOrgContent } from "@/components/lk-org-content"
import { DoctorsApi } from "@/lib/api/doctors"
import { getSessionFromCookie } from "@/lib/auth/getSessionFromCookie"

export const metadata = {
  title: "Кабинет организации | smartcardio",
  description: "Управление врачами организации на платформе smartcardio Телемедицина",
}

export default async function LkOrgPage() {
  const requestHeaders = await headers()

  // Check organisations-token cookie for org auth
  const org = await getSessionFromCookie<{ id: number; name?: string; email: string }>(
    requestHeaders,
    'organisations-token',
    'organisations',
  )

  if (!org) {
    redirect("/")
  }

  // Fetch only this organisation's doctors
  const doctors = await DoctorsApi.fetchByOrganisation(org.id)

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <LkOrgContent userName={org.name || org.email} initialDoctors={doctors} orgId={org.id} />
      <Footer />
    </div>
  )
}
