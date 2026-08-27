import { headers } from "next/headers"
import { Footer } from "@/components/footer"
import { LkOrgGate } from "@/components/lk-org-gate"
import { OrgConsultationsContent } from "@/components/lk-org/OrgConsultationsContent"
import { DoctorsApi } from "@/lib/api/doctors"
import { getSessionFromCookie } from "@/lib/auth/getSessionFromCookie"

export const metadata = {
  title: "Консультации организации",
  description: "Просмотр консультаций врачей организации на платформе smartcardio Видеоконсультация с врачом",
}

interface PageProps {
  searchParams: Promise<{ sort?: string }>
}

export default async function OrgConsultationsPage({ searchParams }: PageProps) {
  const requestHeaders = await headers()
  const params = await searchParams
  
  const org = await getSessionFromCookie<{ id: number; name?: string; email: string }>(
    requestHeaders,
    'organisations-token',
    'organisations',
  )

  const doctors = org ? await DoctorsApi.fetchByOrganisation(org.id) : []
  const doctorIds = doctors.map(d => d.id)

  const allowedSorts = ['all', 'future', 'past', 'cancelled'] as const
  const sortParam = allowedSorts.find((sort) => sort === params.sort) ?? 'all'

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <LkOrgGate initialOrg={org} initialDoctors={doctors}>
        <OrgConsultationsContent
          orgId={org?.id ?? 0}
          orgName={org?.name ?? org?.email ?? ""}
          doctorIds={doctorIds}
          initialSort={sortParam}
        />
      </LkOrgGate>
      <Footer />
    </div>
  )
}
