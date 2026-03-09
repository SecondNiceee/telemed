import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { LkContent } from "@/components/lk-content"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { AuthApi, AppointmentsApi } from "@/lib/api/index"
import type { ApiAppointment } from "@/lib/api/types"

export const dynamic = "force-dynamic"

export default async function LkPage() {
  let user = null;
  let appointments: ApiAppointment[] = [];
  
  try {
    const hdrs = await headers()
    const cookie = hdrs.get("cookie") ?? ""
    
    // Fetch user
    user = await AuthApi.meServer({ cookie })
    if (!user) {
      redirect("/")
    }
    
    // Fetch appointments on server
    appointments = await AppointmentsApi.fetchMyAppointmentsServer({ cookie })
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
