import { headers } from "next/headers"
import { Footer } from "@/components/footer"
import { LkOrgGate } from "@/components/lk-org-gate"
import { DoctorsApi } from "@/lib/api/doctors"
import { AppointmentsApi } from "@/lib/api/appointments"
import { getSessionFromCookie } from "@/lib/auth/getSessionFromCookie"

export const metadata = {
  title: "Кабинет организации | smartcardio",
  description: "Управление врачами организации на платформе smartcardio Телемедицина",
}

export interface OrgStats {
  total: number
  upcoming: number
  past: number
  active: number
}

export default async function LkOrgPage() {
  const requestHeaders = await headers()
  const cookie = requestHeaders.get("cookie") ?? ""

  const org = await getSessionFromCookie<{ id: number; name?: string; email: string }>(
    requestHeaders,
    'organisations-token',
    'organisations',
  )

  // If org is authenticated on server, pre-fetch doctors and appointments
  const doctors = org ? await DoctorsApi.fetchByOrganisation(org.id) : []
  
  // Calculate stats from appointments
  let stats: OrgStats = { total: 0, upcoming: 0, past: 0, active: 0 }
  
  if (org && doctors.length > 0) {
    const doctorIds = doctors.map(d => d.id)
    const appointments = await AppointmentsApi.fetchByDoctorsServer(doctorIds, { cookie })
    
    const now = new Date()
    stats = appointments.reduce((acc, appt) => {
      if (appt.status === 'cancelled') return acc
      acc.total++
      
      if (appt.status === 'in_progress') {
        acc.active++
      } else if (appt.status === 'completed') {
        acc.past++
      } else {
        const apptDate = new Date(`${appt.date}T${appt.time}`)
        if (apptDate < now) {
          acc.past++
        } else {
          acc.upcoming++
        }
      }
      return acc
    }, { total: 0, upcoming: 0, past: 0, active: 0 })
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <LkOrgGate initialOrg={org} initialDoctors={doctors} initialStats={stats} />
      <Footer />
    </div>
  )
}
