"use client";

import { X } from "lucide-react";
import { useState } from "react";
import type { ApiAppointment } from "@/lib/api/types";

interface ConsultationGuideProps {
  appointment: ApiAppointment;
}

const steps = [
  {
    num: 1,
    title: "Загрузите документы",
    description: "Прикрепите в чате анализы, ЭКГ и другие файлы — врач изучит их до приёма.",
  },
  {
    num: 2,
    title: "Перейдите в чат",
    description: "Опишите жалобы и задайте вопросы. Видеозвонок начнётся в назначенное время.",
  },
  {
    num: 3,
    title: "Получите заключение",
    description: "Врач отправит рекомендации и заключение в чат после консультации.",
  },
];

/**
 * Памятка о порядке консультации. Шаги пронумерованы и соединены линией
 * бренда (бирюзовый → фиолетовый) — без иконок, чтобы не спорить с карточками записей.
 */
export function ConsultationGuide({ appointment }: ConsultationGuideProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  const isUpcoming = appointment.status === "confirmed";
  const isActive = appointment.status === "in_progress";

  // Only show for upcoming or active consultations
  if (!isUpcoming && !isActive) return null;

  return (
    <section className="relative mb-6 overflow-hidden rounded-2xl bg-card shadow-[0_0_0_1px_oklch(0_0_0_/_0.07),0_14px_34px_-16px_oklch(0.2079_0.0399_265.8_/_0.18)]">
      {/* Градиентная черта бренда */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{
          background: "linear-gradient(to right, var(--teal), var(--primary) 70%, transparent)",
        }}
      />

      <div className="px-5 pb-5 pt-6 sm:px-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal">
              Памятка
            </p>
            <h3 className="mt-1.5 text-pretty text-lg font-bold tracking-[-0.01em] text-foreground">
              Как проходит консультация
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            aria-label="Скрыть памятку"
            className="-mr-1 -mt-1 shrink-0 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <ol className="relative flex flex-col gap-5 sm:flex-row sm:gap-6">
          {/* Соединительная линия между шагами (только на широких экранах) */}
          <span
            aria-hidden="true"
            className="absolute left-[15px] top-2 hidden h-[calc(100%-1rem)] w-px sm:left-0 sm:top-[15px] sm:h-px sm:w-full sm:block"
            style={{
              background:
                "linear-gradient(to right, var(--teal) 0%, var(--primary) 100%)",
              opacity: 0.25,
            }}
          />

          {steps.map((step) => (
            <li key={step.num} className="relative flex flex-1 gap-3.5 sm:flex-col sm:gap-3">
              <span
                className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card font-mono text-sm font-bold text-primary ring-[1.5px] ring-inset ring-primary/25"
              >
                {step.num}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-snug text-foreground">
                  {step.title}
                </p>
                <p className="mt-1 text-pretty text-[13px] leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
