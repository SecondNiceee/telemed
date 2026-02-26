import { Metadata } from "next"
import { headers } from "next/headers"
import { Footer } from "@/components/footer"
import { LkOrgGate } from "@/components/lk-org-gate"
import { LkOrgDoctorEdit } from "@/components/lk-org-doctor-edit"
import { DoctorsApi } from "@/lib/api/doctors"
import { getSessionFromCookie } from "@/lib/auth/getSessionFromCookie"

export const metadata: Metadata = {
  title: "Редактирование врача | smartcardio",
  description: "Редактирование информации врача в системе smartcardio",
}

interface DoctorEditPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function DoctorEditPage({ params }: DoctorEditPageProps) {
  const { id } = await params
  const doctorId = parseInt(id)

  const requestHeaders = await headers()
  const org = await getSessionFromCookie<{ id: number; name?: string; email: string }>(
    requestHeaders,
    'organisations-token',
    'organisations',
  )

  // Pre-fetch doctors for the gate component
  const doctors = org ? await DoctorsApi.fetchByOrganisation(org.id) : []

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <LkOrgGate initialOrg={org} initialDoctors={doctors}>
        <LkOrgDoctorEdit doctorId={doctorId} orgId={org?.id || 0} />
      </LkOrgGate>
      <Footer />
    </div>
  )
}
