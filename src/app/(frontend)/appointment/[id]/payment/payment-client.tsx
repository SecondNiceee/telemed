"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Loader2, MessageSquare, Mic, ShieldCheck, Video } from "lucide-react";
import { AppointmentsApi } from "@/lib/api/appointments";
import { ApiError } from "@/lib/api/errors";
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
  /** По записи есть незавершённый платёж в ЮKassa. */
  hasPendingPayment: boolean;
  paymentStatus: "pending" | "canceled" | null;
}

const CONNECTION_LABELS: Record<string, { label: string; icon: typeof MessageSquare }> = {
  chat: { label: "Чат", icon: MessageSquare },
  audio: { label: "Аудиозвонок", icon: Mic },
  video: { label: "Видеозвонок", icon: Video },
};

/** Интервал опроса статуса оплаты после возврата с ЮKassa. */
const POLL_INTERVAL_MS = 3000;

/**
 * Сколько всего ждём подтверждения после возврата.
 * Дальше ждать смысла нет: если деньги придут позже, исход всё равно разберёт
 * уведомление ЮKassa — подтвердит запись или вернёт оплату.
 */
const POLL_TIMEOUT_MS = 90_000;

export function PaymentPageClient({
  appointment,
  returnedFromPayment = false,
}: {
  appointment: PaymentAppointment;
  returnedFromPayment?: boolean;
}) {
  const router = useRouter();

  const [msLeft, setMsLeft] = useState(() => getMsLeft(appointment.paymentExpiresAt));
  const [paying, setPaying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(
    // Платёж был создан, но ЮKassa его отменила — значит оплата не удалась.
    appointment.paymentStatus === "canceled"
      ? "Предыдущая попытка оплаты не удалась. Попробуйте ещё раз."
      : null,
  );

  // Пациент вернулся с платёжной страницы, а деньги ещё не подтверждены:
  // страница ждёт, пока сверка с ЮKassa не даст результат.
  const [awaiting, setAwaiting] = useState(returnedFromPayment && appointment.hasPendingPayment);

  // Освобождение брони должно произойти ровно один раз, даже если
  // таймер и клик по «Отменить» сработают почти одновременно.
  const releasedRef = useRef(false);

  /**
   * Уйти со страницы, отменив бронь.
   *
   * Бронь с созданным платежом клиент НЕ отменяет: деньги могли уже уйти, и
   * отмена оставила бы пациента без записи и без возврата. Такую бронь
   * разбирает сервер — он либо подтвердит запись, либо вернёт деньги и
   * освободит слот (см. lib/server/appointment-payments.ts).
   */
  const leave = useCallback(
    async (reason: "expired" | "cancelled") => {
      if (releasedRef.current) return;
      releasedRef.current = true;

      const hasPayment = appointment.hasPendingPayment;

      if (!hasPayment) {
        try {
          await AppointmentsApi.release(appointment.id);
        } catch {
          // Даже если запрос не прошёл, слот освободит фоновая проверка
          // просроченных броней на сервере.
        }
      }

      router.replace(`/doctor/${appointment.doctorId}?payment=${reason}`);
      router.refresh();
    },
    [appointment.id, appointment.doctorId, appointment.hasPendingPayment, router],
  );

  // Тик таймера оплаты.
  useEffect(() => {
    if (!appointment.paymentExpiresAt) return;

    const tick = () => {
      const left = getMsLeft(appointment.paymentExpiresAt);
      setMsLeft(left);
      if (left <= 0) leave("expired");
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [appointment.paymentExpiresAt, leave]);

  // Опрос статуса оплаты после возврата с ЮKassa.
  useEffect(() => {
    if (!awaiting) return;

    let cancelled = false;
    const startedAt = Date.now();

    const poll = async () => {
      if (cancelled) return;

      try {
        const status = await AppointmentsApi.paymentStatus(appointment.id);

        if (cancelled) return;

        if (status.appointmentStatus === "confirmed") {
          releasedRef.current = true;
          router.replace("/lk?payment=success");
          router.refresh();
          return;
        }

        // Деньги вернули: пока шла оплата, слот успели отдать.
        if (status.refunded) {
          releasedRef.current = true;
          router.replace(`/doctor/${appointment.doctorId}?payment=refunded`);
          router.refresh();
          return;
        }

        // ЮKassa отменила платёж — можно попробовать оплатить заново,
        // если бронь ещё жива.
        if (status.paymentStatus === "canceled") {
          setAwaiting(false);
          setError("Оплата не прошла. Попробуйте ещё раз.");
          return;
        }
      } catch {
        // Разрыв связи — просто пробуем на следующем тике.
      }

      if (cancelled) return;

      if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
        setAwaiting(false);
        setError(
          "Мы пока не получили подтверждение оплаты. Если деньги списались, запись появится в личном кабинете автоматически.",
        );
        return;
      }

      timer = setTimeout(poll, POLL_INTERVAL_MS);
    };

    let timer = setTimeout(poll, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [awaiting, appointment.id, appointment.doctorId, router]);

  const handlePay = async () => {
    setError(null);
    setPaying(true);

    try {
      const result = await AppointmentsApi.pay(appointment.id);

      // Оплата уже прошла (например, двойной клик после успешного платежа).
      if (result.status === "confirmed" || !result.confirmationUrl) {
        releasedRef.current = true;
        router.replace("/lk?payment=success");
        router.refresh();
        return;
      }

      // Уходим на страницу ЮKassa. Бронь при этом не отменяем: платёж создан,
      // и его исход разберёт сервер.
      releasedRef.current = true;
      window.location.href = result.confirmationUrl;
    } catch (err) {
      setPaying(false);

      // Бронь истекла, пока пациент был на странице — слот уже освобождён.
      if (err instanceof ApiError && err.status === 410) {
        releasedRef.current = true;
        router.replace(`/doctor/${appointment.doctorId}?payment=expired`);
        router.refresh();
        return;
      }

      setError(err instanceof Error ? err.message : "Не удалось начать оплату");
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    await leave("cancelled");
  };

  const connection = appointment.connectionType
    ? CONNECTION_LABELS[appointment.connectionType]
    : null;
  const ConnectionIcon = connection?.icon;

  const busy = paying || cancelling || awaiting;
  // Последние две минуты подсвечиваем, чтобы таймер точно заметили.
  const urgent = msLeft > 0 && msLeft <= 2 * 60 * 1000;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      {/* Статус брони */}
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-teal/10 ring-1 ring-teal/25">
          {awaiting ? (
            <Loader2 className="h-7 w-7 animate-spin text-teal" aria-hidden="true" />
          ) : (
            <Check className="h-7 w-7 text-teal" aria-hidden="true" />
          )}
        </div>
        <h1 className="text-2xl font-semibold text-foreground text-balance sm:text-3xl">
          {awaiting ? "Проверяем оплату" : "Запись подтверждена"}
        </h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground text-pretty">
          {awaiting
            ? "Платёж обрабатывается банком. Не закрывайте страницу — как только оплата подтвердится, запись появится в личном кабинете."
            : "Время у врача забронировано за вами и скрыто от других пациентов. Осталось оплатить консультацию — запись находится в процессе оплаты."}
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
              {paying || awaiting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {awaiting ? "Ждём подтверждения..." : "Переходим к оплате..."}
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

          {/* Оплата идёт на стороне ЮKassa — это стоит сказать до перехода. */}
          <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-teal" aria-hidden="true" />
            Оплата картой на защищённой странице ЮKassa
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
