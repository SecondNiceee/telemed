"use client";

import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  GraduationCap,
  Award,
  CheckCircle,
  User,
  FileText,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import { DoctorReviews } from "@/components/doctor-reviews";
import { DoctorBookingSection } from "@/components/doctor-booking-section";
import type { DoctorScheduleDate } from "@/lib/api/types";
import { getConsultationDurationLabel } from "@/lib/utils/consultation-duration";
import { toOptimizableMediaSrc } from "@/lib/utils/media";

interface DoctorPageClientProps {
  doctor: {
    id: number;
    name: string | null;
    email: string;
    price: number | null;
    experience: number | null;
    degree: string | null;
    bio: string | null;
    slotDuration?: string | null;
  };
  photoUrl: string | null;
  specialty: string;
  education: string[];
  services: string[];
  categories: { slug: string }[];
  schedule: DoctorScheduleDate[];
}

/** Строка «паспорта» врача в шапке: подпись сверху, значение снизу. */
interface DoctorFact {
  label: string;
  value: string;
}

/** Блок досье: маркер на бирюзовой «спине», надзаголовок и произвольный контент. */
interface DossierEntry {
  key: string;
  label: string;
  icon: LucideIcon;
  content: ReactNode;
}

export function DoctorPageClient({
  doctor,
  photoUrl,
  specialty,
  education,
  services,
  categories,
  schedule,
}: DoctorPageClientProps) {
  const firstCategorySlug = categories[0]?.slug;
  // Payload может отдать абсолютный URL (задан serverURL) — приводим к пути,
  // иначе /_next/image отклонит внешний origin.
  const optimizedPhotoUrl = toOptimizableMediaSrc(photoUrl);
  // null, если врач не выставил ни одного слота — длительность тогда неизвестна.
  const consultationDuration = getConsultationDurationLabel({
    slotDuration: doctor.slotDuration,
    schedule,
  });

  /** Ключевые факты идут в шапку одной «приборной» строкой вместо списка label: value. */
  const facts: DoctorFact[] = [];
  if (doctor.experience != null) {
    facts.push({ label: "Стаж", value: `${doctor.experience} лет` });
  }
  if (doctor.price != null) {
    facts.push({
      label: "Стоимость консультации",
      value: `${doctor.price.toLocaleString("ru-RU")} ₽`,
    });
  }
  if (consultationDuration) {
    facts.push({ label: "Время консультации", value: consultationDuration });
  }

  /**
   * Все текстовые блоки собираем в одно досье. Раньше это был стек из четырёх
   * одинаковых карточек — самый узнаваемый «шаблонный» приём, поэтому теперь
   * блоки нанизаны на общую вертикальную бирюзовую линию.
   */
  const dossier: DossierEntry[] = [];
  if (doctor.bio) {
    dossier.push({
      key: "bio",
      label: "О враче",
      icon: FileText,
      content: (
        <p className="text-sm leading-relaxed text-muted-foreground">{doctor.bio}</p>
      ),
    });
  }
  if (doctor.degree) {
    dossier.push({
      key: "degree",
      label: "Степень",
      icon: Award,
      content: (
        <p className="text-sm leading-relaxed text-muted-foreground">{doctor.degree}</p>
      ),
    });
  }
  if (education.length > 0) {
    dossier.push({
      key: "education",
      label: "Образование",
      icon: GraduationCap,
      content:
        education.length === 1 ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{education[0]}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {education.map((edu, index) => (
              <li
                key={index}
                className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground"
              >
                <span
                  aria-hidden="true"
                  className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-teal"
                />
                <span>{edu}</span>
              </li>
            ))}
          </ul>
        ),
    });
  }
  if (services.length > 0) {
    dossier.push({
      key: "services",
      label: "Услуги",
      icon: Stethoscope,
      content: (
        <div className="flex flex-wrap gap-2">
          {services.map((service, index) => (
            <span
              key={index}
              className="inline-flex items-center gap-2 rounded-full border border-teal/25 bg-teal/[0.07] px-3 py-1.5 text-sm text-foreground"
            >
              <CheckCircle className="h-3.5 w-3.5 shrink-0 text-teal" aria-hidden="true" />
              {service}
            </span>
          ))}
        </div>
      ),
    });
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <Button
        variant="ghost"
        size="sm"
        asChild
        className="mb-4 rounded-full text-teal hover:bg-teal/10 hover:text-teal"
      >
        <Link href={firstCategorySlug ? `/category/${firstCategorySlug}` : "/#categories"}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Назад к списку врачей
        </Link>
      </Button>

      {/* Booking Section - at top */}
      <div className="mb-3">
        <DoctorBookingSection
          doctorId={doctor.id}
          doctorName={doctor.name || "Врач"}
          doctorSpecialty={specialty}
          doctorPrice={doctor.price ?? 0}
          doctorExperience={doctor.experience}
          doctorDegree={doctor.degree}
          doctorBio={doctor.bio}
          doctorEmail={doctor.email}
          schedule={schedule}
        />
      </div>

      {/* Шапка врача */}
      <div className="sc-card relative mb-3 overflow-hidden">
        {/* Фирменная градиентная линия как в баннере консультации */}
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-teal to-transparent"
        />

        <div className="flex items-start gap-4 p-5 sm:gap-6 sm:p-7">
          {/* Портрет в «рамке снимка»: бирюзовые уголки — единственный акцентный
              элемент шапки, всё остальное держим тихим. */}
          <div className="relative h-28 w-28 shrink-0 sm:h-40 sm:w-40">
            <div className="relative h-full w-full overflow-hidden rounded-2xl bg-teal-soft">
              {optimizedPhotoUrl ? (
                /* fill + sizes: реальный размер портрета 112px (моб.) и 160px
                   (sm+), поэтому оптимизатор отдаёт лёгкий кадр вместо
                   полноразмерного оригинала из админки. priority — портрет
                   находится в первом экране и участвует в LCP. */
                <Image
                  src={optimizedPhotoUrl}
                  alt={doctor.name || "Врач"}
                  fill
                  sizes="(min-width: 640px) 160px, 112px"
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <User className="h-12 w-12 text-teal/50 sm:h-16 sm:w-16" />
                </div>
              )}
            </div>
            {/* Уголки повторяют радиус портрета и прилегают к нему без зазора */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-0 top-0 h-9 w-9 rounded-tr-2xl border-r-2 border-t-2 border-teal"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0 left-0 h-9 w-9 rounded-bl-2xl border-b-2 border-l-2 border-teal"
            />
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold leading-tight text-balance text-foreground sm:text-3xl">
              {doctor.name}
            </h1>
            <span
              aria-hidden="true"
              className="mt-2.5 block h-[2px] w-16 rounded-full bg-gradient-to-r from-teal to-transparent sm:w-24"
            />
            <p className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-base sm:text-lg">
              <span className="font-medium text-muted-foreground">Специальность:</span>
              <span className="font-semibold text-teal">{specialty}</span>
            </p>
          </div>
        </div>

        {/* «Приборная» строка ключевых фактов вместо списка подписей со значениями */}
        {facts.length > 0 && (
          <dl
            className="grid divide-x divide-teal/15 border-t border-teal/15"
            style={{ gridTemplateColumns: `repeat(${facts.length}, minmax(0, 1fr))` }}
          >
            {facts.map((fact) => (
              <div key={fact.label} className="px-4 py-3.5 sm:px-6">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-teal">
                  {fact.label}
                </dt>
                <dd className="mt-1 text-sm font-semibold tabular-nums text-foreground sm:text-base">
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {/* Досье: блоки нанизаны на общую бирюзовую вертикаль */}
      {dossier.length > 0 && (
        <div className="sc-card relative mb-3 px-5 py-6 sm:px-7 sm:py-7">
          <span
            aria-hidden="true"
            className="absolute left-4 top-8 bottom-8 w-px bg-gradient-to-b from-teal/45 via-teal/20 to-transparent"
          />

          <div className="flex flex-col gap-7">
            {dossier.map((entry) => (
              <section key={entry.key} className="relative pl-12 sm:pl-14">
                <span className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-card ring-1 ring-teal/30">
                  <entry.icon className="h-4 w-4 text-teal" aria-hidden="true" />
                </span>
                <h2 className="mb-2 pt-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-teal">
                  {entry.label}
                </h2>
                {entry.content}
              </section>
            ))}
          </div>
        </div>
      )}

      {/* Reviews Section */}
      <DoctorReviews doctorId={doctor.id} doctorName={doctor.name || 'Врач'} />
    </div>
  );
}
