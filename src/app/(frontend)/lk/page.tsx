import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { LkContent } from "@/components/lk-content"
import { BackgroundDecor } from "@/components/background-decor"
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
    
    // Просроченные брони отменяет фоновый sweeper (см. instrumentation.ts),
    // поэтому здесь sweep не запускаем. Истёкшую бронь, которая ещё не попала
    // под фоновый проход, клиент и так показывает по таймеру paymentExpiresAt.

    // Fetch appointments on server - explicitly filter by user ID
    appointments = await AppointmentsApi.fetchMyAppointmentsServer({ cookie, userId: user.id })
  } catch (e) {
    // redirect() throws a special Next.js error — rethrow it
    if (e && typeof e === "object" && "digest" in e) throw e
    console.log(e)
    redirect("/")
  }
  
  return (
    <div className="min-h-screen flex flex-col">
      {/* Сквозной декор как на главной: секции кабинета прозрачные,
          поэтому сетка/ЭКГ/водяной знак просвечивают сквозь них. */}
      <BackgroundDecor id="lk" position="fixed" ecg="bottom" />
      <Header />
      <LkContent user={user} appointments={appointments} />
      <Footer />
    </div>
  )
}
