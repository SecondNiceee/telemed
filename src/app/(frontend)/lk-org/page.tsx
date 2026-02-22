import { headers } from "next/headers"
import { Footer } from "@/components/footer"
import { LkOrgGate } from "@/components/lk-org-gate"
import { DoctorsApi } from "@/lib/api/doctors"
import { getSessionFromCookie } from "@/lib/auth/getSessionFromCookie"

export const metadata = {
  title: "Кабинет организации | smartcardio",
  description: "Управление врачами организации на платформе smartcardio Телемедицина",
}

export default async function LkOrgPage() {
  const requestHeaders = await headers()

  const org = await getSessionFromCookie<{ id: number; name?: string; email: string }>(
    requestHeaders,
    'organisations-token',
    'organisations',
  )

  // If org is authenticated on server, pre-fetch doctors
  const doctors = org ? await DoctorsApi.fetchByOrganisation(org.id) : []

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <LkOrgGate initialOrg={org} initialDoctors={doctors} />
      <Footer />
    </div>
  )
}
