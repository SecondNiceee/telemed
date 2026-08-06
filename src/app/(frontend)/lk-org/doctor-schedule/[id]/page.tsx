import { Metadata } from "next"
import { headers } from "next/headers"
import { Footer } from "@/components/footer"
import { LkOrgGate } from "@/components/lk-org-gate"
import { LkOrgDoctorSchedule } from "@/components/lk-org-doctor-schedule"
import { getSessionFromCookie } from "@/lib/auth/getSessionFromCookie"

export const metadata: Metadata = {
  title: "Расписание врача | smartcardio",
  description: "Настройка расписания врача по датам",
}

interface DoctorSchedulePageProps {
  params: Promise<{
    id: string
  }>
}

export default async function DoctorSchedulePage({ params }: DoctorSchedulePageProps) {
  const { id } = await params
  const doctorId = parseInt(id)

  const requestHeaders = await headers()
  const org = await getSessionFromCookie<{ id: number; name?: string; email: string }>(
    requestHeaders,
    "organisations-token",
    "organisations",
  )

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <LkOrgGate initialOrg={org}>
        <LkOrgDoctorSchedule doctorId={doctorId} orgId={org?.id || 0} />
      </LkOrgGate>
      <Footer />
    </div>
  )
}
