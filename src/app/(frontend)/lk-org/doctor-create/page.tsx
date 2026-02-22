import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { LkOrgDoctorCreate } from "@/components/lk-org-doctor-create"
import { getSessionFromCookie } from "@/lib/auth/getSessionFromCookie"

export const metadata = {
  title: "Создание врача | smartcardio",
  description: "Создание нового врача в кабинете организации на платформе smartcardio Телемедицина",
}

export default async function DoctorCreatePage() {
  const requestHeaders = await headers()

  const org = await getSessionFromCookie<{ id: number; name?: string; email: string }>(
    requestHeaders,
    'organisations-token',
    'organisations',
  )

  // If not authenticated as organisation, redirect to lk-org login
  if (!org) {
    redirect("/lk-org")
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <LkOrgDoctorCreate orgId={org.id} />
      <Footer />
    </div>
  )
}
