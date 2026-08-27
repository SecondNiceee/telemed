import { notFound, redirect } from "next/navigation";
import { getPayload } from "payload";
import config from "@payload-config";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { BackgroundDecor } from "@/components/background-decor";
import { getUserFromCookies } from "@/lib/server/route-auth";
import { releaseHold } from "@/lib/server/appointment-holds";
import { syncAppointmentPayment } from "@/lib/server/appointment-payments";
import { PaymentPageClient } from "./payment-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Оплата консультации",
  description: "Оплатите консультацию, чтобы завершить запись к врачу",
};

interface PaymentPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ return?: string }>;
}

export default async function PaymentPage({ params, searchParams }: PaymentPageProps) {
  const { id } = await params;
  const { return: returned } = await searchParams;
  const appointmentId = parseInt(id, 10);

  if (isNaN(appointmentId)) notFound();

  const { user } = await getUserFromCookies();
  if (!user) redirect("/lk");

  const payload = await getPayload({ config });

  const loadAppointment = () =>
    payload
      .findByID({
        collection: "appointments",
        id: appointmentId,
        depth: 0,
        overrideAccess: true,
      })
      .catch(() => null);

  let appointment = await loadAppointment();

  if (!appointment) notFound();

  const appointmentUserId =
    typeof appointment.user === "object" ? appointment.user.id : appointment.user;

  // Чужую запись оплачивать нельзя.
  if (appointmentUserId !== user.id) notFound();

  /**
   * Сверка с ЮKassa до любых решений.
   *
   * Уведомление могло не дойти (или ещё не дойти), а возврат пациента на сайт
   * сам по себе ничего не подтверждает. Поэтому если по записи есть платёж —
   * читаем его фактический статус и применяем исход: подтверждаем запись или
   * возвращаем деньги, если слот уже потерян.
   *
   * Важно, что этот блок стоит ДО проверки срока брони: иначе успешная, но
   * поздно доехавшая оплата попадала бы под releaseHold без возврата денег.
   */
  const paymentState = (appointment as { payment?: { paymentId?: string | null } | null }).payment;

  if (appointment.status === "pending_payment" && paymentState?.paymentId) {
    await syncAppointmentPayment({ payload, appointmentId });
    appointment = (await loadAppointment()) ?? appointment;
  }

  const doctorId =
    typeof appointment.doctor === "object" ? appointment.doctor.id : appointment.doctor;

  // Оплата прошла — уводим в личный кабинет к готовой записи.
  if (appointment.status === "confirmed") {
    redirect("/lk?payment=success");
  }

  // Бронь снята (истекла, отменена или деньги вернули) — платить уже нечего.
  if (appointment.status !== "pending_payment") {
    const refunded =
      (appointment as { payment?: { status?: string | null } | null }).payment?.status ===
      "refunded";
    redirect(`/doctor/${doctorId}?payment=${refunded ? "refunded" : "cancelled"}`);
  }

  // Бронь истекла, пока страница была закрыта: освобождаем слот и уводим к врачу.
  const expiresAt = appointment.paymentExpiresAt;
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
    await releaseHold({ payload, appointmentId });
    redirect(`/doctor/${doctorId}?payment=expired`);
  }

  const payment = (appointment as {
    payment?: { paymentId?: string | null; status?: string | null } | null;
  }).payment;

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
            // Платёж создан, но деньги пока не получены: пациент либо ещё на
            // стороне ЮKassa, либо оплата не удалась и можно попробовать снова.
            hasPendingPayment: !!payment?.paymentId && payment.status !== "canceled",
            paymentStatus: (payment?.status as "pending" | "canceled" | null) ?? null,
          }}
          // Пациент вернулся с платёжной страницы: показываем ожидание и
          // опрашиваем сервер, пока платёж не подтвердится.
          returnedFromPayment={returned === "1"}
        />
      </main>
      <Footer />
    </div>
  );
}
