import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { LkContent } from "@/components/lk-content"
import { BackgroundDecor } from "@/components/background-decor"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { AuthApi, AppointmentsApi, MessagesApi } from "@/lib/api/index"
import type { ApiAppointment } from "@/lib/api/types"
import { releaseExpiredHolds } from "@/lib/server/appointment-holds"

export const dynamic = "force-dynamic"

export default async function LkPage() {
  let user = null;
  let appointments: ApiAppointment[] = [];
  // Непрочитанные из БД: без них точка «новое сообщение» не появлялась бы
  // до прихода живого события сокета.
  let unreadCounts: Record<number, number> = {};
  
  try {
    const hdrs = await headers()
    const cookie = hdrs.get("cookie") ?? ""
    
    // Fetch user
    user = await AuthApi.meServer({ cookie })
    if (!user) {
      redirect("/")
    }
    
    // Штатно просроченные брони отменяет фоновый sweeper (стартует из onInit
    // в src/payload.config.ts), но он ходит раз в минуту. В промежутке между
    // истечением брони и его проходом кабинет показывал активную кнопку
    // «Оплатить»: UserAppointmentCard смотрит только на status и ничего
    // не знает про paymentExpiresAt.
    //
    // Поэтому перед чтением записей делаем адресный проход по этому
    // пользователю. Он опирается на индекс (user, status, paymentExpiresAt),
    // так что при отсутствии просрочек стоит около нуля, а свой троттл
    // (10 секунд на скоуп user) не даёт пачке перезагрузок страницы
    // превратиться в пачку sweep'ов.
    await releaseExpiredHolds({ userId: user.id })

    // Fetch appointments on server - explicitly filter by user ID
    appointments = await AppointmentsApi.fetchMyAppointmentsServer({ cookie, userId: user.id })
    unreadCounts = await MessagesApi.fetchUnreadCountsServer({ cookie, currentSenderType: "user" })
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
      <LkContent user={user} appointments={appointments} initialUnreadCounts={unreadCounts} />
      <Footer />
    </div>
  )
}
