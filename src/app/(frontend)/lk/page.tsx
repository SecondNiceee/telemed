import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { LkContent } from "@/components/lk-content"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { getBaseUrl } from "@/lib/api/fetch"
import type { ApiAppointment, PayloadListResponse } from "@/lib/api/types"

export const dynamic = "force-dynamic"

export default async function LkPage() {
  let user = null;
  let appointments: ApiAppointment[] = [];
  
  try {
    const hdrs = await headers()
    const cookie = hdrs.get("cookie") ?? ""
    const baseUrl = getBaseUrl()
    
    // Fetch user
    const userRes = await fetch(`${baseUrl}/api/users/me`, {
      headers: { cookie },
      cache: "no-store",
    })
    if (userRes.ok) {
      const data = await userRes.json()
      user = data.user ?? null
    }
    if (!user) {
      redirect("/")
    }
    
    // Fetch appointments on server
    const apptRes = await fetch(`${baseUrl}/api/appointments?limit=100&depth=1&sort=-date`, {
      headers: { cookie },
      cache: "no-store",
    })
    if (apptRes.ok) {
      const data: PayloadListResponse<ApiAppointment> = await apptRes.json()
      appointments = data.docs
    }
  } catch (e) {
    // redirect() throws a special Next.js error — rethrow it
    if (e && typeof e === "object" && "digest" in e) throw e
    console.log(e)
    redirect("/")
  }
  
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <LkContent user={user} appointments={appointments} />
      <Footer />
    </div>
  )
}
