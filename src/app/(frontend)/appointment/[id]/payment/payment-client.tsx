"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Loader2, MessageSquare, Mic, Video } from "lucide-react";
import { AppointmentsApi } from "@/lib/api/appointments";
import { formatDate } from "@/lib/utils/date";
import {
  PAYMENT_WINDOW_MINUTES,
  formatPaymentCountdown,
  getMsLeft,
} from "@/lib/constants/payment";

interface PaymentAppointment {
  id: number;
  doctorId: number;
  doctorName: string | null;
  specialty: string | null;
  date: string;
  time: string;
  price: number;
  connectionType: "chat" | "audio" | "video" | null;
  paymentExpiresAt: string | null;
}

const CONNECTION_LABELS: Record<string, { label: string; icon: typeof MessageSquare }> = {
  chat: { label: "Чат", icon: MessageSquare },
  audio: { label: "Аудиозвонок", icon: Mic },
  video: { label: "Видеозвонок", icon: Video },
};

export function PaymentPageClient({ appointment }: { appointment: PaymentAppointment }) {
  const router = useRouter();

  const [msLeft, setMsLeft] = useState(() => getMsLeft(appointment.paymentExpiresAt));
  const [paying, setPaying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Освобождение брони должно произойти ровно один раз, даже если
  // таймер и клик по «Отменить» сработают почти одновременно.
  const releasedRef = useRef(false);

  const releaseAndLeave = useCallback(
    async (reason: "expired" | "cancelled") => {
      if (releasedRef.current) return;
      releasedRef.current = true;

      try {
        await AppointmentsApi.release(appointment.id);
      } catch {
        // Даже если запрос не прошёл, слот освободит серверная проверка
        // просроченных броней при следующем заходе на страницу врача.
      }

      router.replace(`/doctor/${appointment.doctorId}?payment=${reason}`);
      router.refresh();
    },
    [appointment.id, appointment.doctorId, router],
  );

  // Тик таймера оплаты.
  useEffect(() => {
    if (!appointment.paymentExpiresAt) return;

    const tick = () => {
      const left = getMsLeft(appointment.paymentExpiresAt);
      setMsLeft(left);
      if (left <= 0) releaseAndLeave("expired");
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [appointment.paymentExpiresAt, releaseAndLeave]);

  const handlePay = async () => {
    setError(null);
    setPaying(true);
    try {
      await AppointmentsApi.pay(appointment.id);
      // Оплата прошла — бронь больше не нужно освобождать.
      releasedRef.current = true;
      router.replace("/lk");
      router.refresh();
    } catch (err) {
      setPaying(false);
      const message = err instanceof Error ? err.message : "Не удалось выполнить оплату";
      setError(message);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    await releaseAndLeave("cancelled");
  };

  const connection = appointment.connectionType
    ? CONNECTION_LABELS[appointment.connectionType]
    : null;
  const ConnectionIcon = connection?.icon;

  const busy = paying || cancelling;
  // Последние две минуты подсвечиваем, чтобы таймер точно заметили.
  const urgent = msLeft > 0 && msLeft <= 2 * 60 * 1000;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      {/* Статус брони */}
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-teal/10 ring-1 ring-teal/25">
          <Check className="h-7 w-7 text-teal" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground text-balance sm:text-3xl">
          Запись подтверждена
        </h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground text-pretty">
          Время у врача забронировано за вами и скрыто от других пациентов. Осталось
          оплатить консультацию — запись находится в процессе оплаты.
        </p>
      </div>

      <Card className="overflow-hidden border-teal/25 py-0">
        {/* Фирменная бирюзовая линия — как в карточках врача */}
        <span
          aria-hidden="true"
          className="block h-1 bg-gradient-to-r from-teal via-primary to-transparent"
        />
        <CardContent className="px-4 py-5 sm:px-6">
          {/* Таймер */}
          <div
            className={`mb-5 flex flex-col items-center rounded-xl border px-4 py-4 text-center transition-colors ${
              urgent
                ? "border-destructive/30 bg-destructive/5"
                : "border-teal/30 bg-teal/[0.05]"
            }`}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Бронь действует ещё
            </p>
            <p
              className={`mt-1 font-mono text-4xl font-semibold tabular-nums ${
                urgent ? "text-destructive" : "text-teal"
              }`}
              role="timer"
              aria-live="off"
            >
              {formatPaymentCountdown(msLeft)}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground text-pretty">
              Если не оплатить за {PAYMENT_WINDOW_MINUTES} минут, время снова станет
              доступным для записи
            </p>
          </div>

          {/* Детали записи */}
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted-foreground">Врач</dt>
              <dd className="text-right font-medium text-foreground">
                {appointment.doctorName || "Врач"}
                {appointment.specialty && (
                  <span className="block text-xs font-normal text-muted-foreground">
                    {appointment.specialty}
                  </span>
                )}
              </dd>
            </div>

            <div className="flex items-baseline justify-between gap-4 border-t border-teal/15 pt-3">
              <dt className="text-muted-foreground">Дата и время</dt>
              <dd className="text-right font-medium text-foreground">
                {formatDate(appointment.date)}, {appointment.time}
              </dd>
            </div>

            {connection && ConnectionIcon && (
              <div className="flex items-baseline justify-between gap-4 border-t border-teal/15 pt-3">
                <dt className="text-muted-foreground">Способ связи</dt>
                <dd className="flex items-center gap-1.5 font-medium text-foreground">
                  <ConnectionIcon className="h-4 w-4 text-teal" aria-hidden="true" />
                  {connection.label}
                </dd>
              </div>
            )}

            <div className="flex items-baseline justify-between gap-4 border-t border-teal/15 pt-3">
              <dt className="font-medium text-foreground">К оплате</dt>
              <dd className="text-xl font-semibold text-teal">
                {appointment.price.toLocaleString("ru-RU")} ₽
              </dd>
            </div>
          </dl>

          {error && (
            <p className="mt-4 text-center text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          {/* Действия */}
          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row-reverse">
            <Button
              size="lg"
              onClick={handlePay}
              disabled={busy || msLeft <= 0}
              className="w-full bg-teal text-teal-foreground hover:bg-teal/90 sm:flex-1"
            >
              {paying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Оплата...
                </>
              ) : (
                <>Оплатить {appointment.price.toLocaleString("ru-RU")} ₽</>
              )}
            </Button>
            <Button
              size="lg"
              variant="ghost"
              onClick={handleCancel}
              disabled={busy}
              className="w-full text-muted-foreground hover:bg-teal/10 hover:text-teal sm:w-auto"
            >
              {cancelling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Отмена...
                </>
              ) : (
                "Отменить"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
