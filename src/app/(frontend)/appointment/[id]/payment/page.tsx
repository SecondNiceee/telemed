import { notFound, redirect } from "next/navigation";
import { getPayload } from "payload";
import config from "@payload-config";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { BackgroundDecor } from "@/components/background-decor";
import { getUserFromCookies } from "@/lib/server/route-auth";
import { releaseHold } from "@/lib/server/appointment-holds";
import { PaymentPageClient } from "./payment-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Оплата консультации - smartcardio",
  description: "Оплатите консультацию, чтобы завершить запись к врачу",
};

interface PaymentPageProps {
  params: Promise<{ id: string }>;
}

export default async function PaymentPage({ params }: PaymentPageProps) {
  const { id } = await params;
  const appointmentId = parseInt(id, 10);

  if (isNaN(appointmentId)) notFound();

  const { user } = await getUserFromCookies();
  if (!user) redirect("/lk");

  const payload = await getPayload({ config });

  const appointment = await payload
    .findByID({
      collection: "appointments",
      id: appointmentId,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null);

  if (!appointment) notFound();

  const appointmentUserId =
    typeof appointment.user === "object" ? appointment.user.id : appointment.user;

  // Чужую запись оплачивать нельзя.
  if (appointmentUserId !== user.id) notFound();

  // Уже оплачено — незачем держать пользователя на странице оплаты.
  if (appointment.status !== "pending_payment") {
    redirect("/lk");
  }

  // Бронь истекла, пока страница была закрыта: освобождаем слот и уводим к врачу.
  const expiresAt = appointment.paymentExpiresAt;
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
    await releaseHold({ payload, appointmentId });
    const doctorId =
      typeof appointment.doctor === "object" ? appointment.doctor.id : appointment.doctor;
    redirect(`/doctor/${doctorId}?payment=expired`);
  }

  const doctorId =
    typeof appointment.doctor === "object" ? appointment.doctor.id : appointment.doctor;

  return (
    <div className="min-h-screen flex flex-col">
      <BackgroundDecor id="payment" position="fixed" ecg={false} />
      <Header />
      <main className="relative z-10 flex-1 bg-transparent">
        <PaymentPageClient
          appointment={{
            id: appointment.id,
            doctorId: Number(doctorId),
            doctorName: appointment.doctorName ?? null,
            specialty: appointment.specialty ?? null,
            date: appointment.date,
            time: appointment.time,
            price: appointment.price ?? 0,
            connectionType: appointment.connectionType ?? null,
            paymentExpiresAt: expiresAt ?? null,
          }}
        />
      </main>
      <Footer />
    </div>
  );
}
