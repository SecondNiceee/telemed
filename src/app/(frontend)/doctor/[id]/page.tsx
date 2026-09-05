import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { BackgroundDecor } from "@/components/background-decor";
import { Button } from "@/components/ui/button";
import {
  fetchDoctorById,
  getDoctorSpecialty,
  getDoctorEducation,
  getDoctorServices,
  getDoctorCategories,
  ApiError,
  getErrorMessage,
  type ApiDoctor,
} from "@/lib/api/index";
import { Media } from "@/payload-types";
import { getFreshDoctorSchedule, releaseExpiredHolds } from "@/lib/server/appointment-holds";
import { DoctorPageClient } from "./doctor-page-client";
import { buildMetadata } from "@/lib/seo";

export const dynamic = 'force-dynamic';

interface DoctorPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: DoctorPageProps): Promise<Metadata> {
  const { id } = await params;

  try {
    const doctor = await fetchDoctorById(id);
    const specialty = getDoctorSpecialty(doctor);
    // getDoctorSpecialty отдаёт 'Врач', когда категории не заданы. В этом случае
    // строка «Иванов И.И. — врач» ничего не сообщает, поэтому специальность
    // упоминаем только когда она реальная.
    const hasSpecialty = specialty !== "Врач";
    const name = doctor.name?.trim();

    if (!name) {
      // Имя — единственное, что делает страницу врача осмысленной в выдаче.
      return buildMetadata({
        title: "Профиль врача",
        description: "Профиль врача и запись на видеоконсультацию.",
        index: false,
      });
    }

    // Стаж добавляем в описание, только если он заполнен: описание видно в
    // выдаче, и «стаж 0 лет» отталкивает сильнее, чем его отсутствие.
    const experience =
      typeof doctor.experience === "number" && doctor.experience > 0
        ? ` Стаж ${doctor.experience} лет.`
        : "";

    return buildMetadata({
      title: hasSpecialty ? `${name} — ${specialty}` : name,
      description: hasSpecialty
        ? `${name} — ${specialty}.${experience} Запишитесь на онлайн-консультацию в удобное время.`
        : `${name}.${experience} Запишитесь на онлайн-консультацию в удобное время.`,
      path: `/doctor/${id}`,
      keywords: hasSpecialty ? [name, specialty, `${specialty} онлайн`] : [name],
    });
  } catch {
    // Врач не найден или база недоступна: индексировать такую страницу нельзя.
    return buildMetadata({
      title: "Профиль врача",
      description: "Профиль врача и запись на видеоконсультацию.",
      index: false,
    });
  }
}

export default async function DoctorPage({ params }: DoctorPageProps) {
  const { id } = await params;

  let doctor: ApiDoctor | null = null;
  let error: string | null = null;

  try {
    doctor = await fetchDoctorById(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    error = getErrorMessage(err);
  }

  if (error || !doctor) {
    return (
      <div className="min-h-screen flex flex-col">
        <BackgroundDecor id="doctor-error" position="fixed" />
        <Header />
        <main className="relative z-10 flex-1 flex items-center justify-center">
          <div className="text-center px-4">
            <p className="text-destructive text-lg mb-4">{error || "Врач не найден"}</p>
            <Button variant="outline" asChild className="rounded-full border-teal/40 text-teal hover:bg-teal/10 hover:text-teal transition-all">
              <Link href="/#categories">На главную</Link>
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Штатно просроченные брони освобождает фоновый sweeper (стартует из onInit
  // в src/payload.config.ts), но он ходит раз в минуту — до его прохода слот
  // выглядел занятым, хотя пациент так и не оплатил.
  //
  // Поэтому перед чтением расписания делаем адресный проход по этому врачу:
  // он опирается на индекс (doctor, status, paymentExpiresAt), поэтому при
  // отсутствии просрочек стоит около нуля, а троттл скоупа doctor (10 секунд)
  // не даёт пачке заходов на страницу превратиться в пачку sweep'ов.
  await releaseExpiredHolds({ doctorId: doctor.id });

  //
  // Расписание читаем напрямую из БД всегда. Раньше здесь стояло
  // `releasedCount > 0 ? свежее : doctor.schedule`, но из-за троттла sweep'а
  // `0` означал не только «нечего освобождать», но и «проход пропущен» —
  // и тогда страница отдавала расписание из кеша, без слотов, освобождённых
  // фоновым проходом. Страница и так force-dynamic, так что кеш тут не нужен.
  const schedule = await getFreshDoctorSchedule(doctor.id);

  const photoUrl = (doctor.photo as Media)?.url ?? null;
  const specialty = getDoctorSpecialty(doctor);
  // Юрлицо, с которым пациент заключает договор на консультацию. Полное
  // наименование предпочтительнее короткого: именно оно должно совпадать с
  // реестром /legal/clinics, куда ведёт ссылка со страницы. Если реквизиты ещё
  // не заполнены — показываем хотя бы рабочее название.
  const organisation =
    typeof doctor.organisation === "object" && doctor.organisation !== null
      ? (doctor.organisation.legalName?.trim() || doctor.organisation.name?.trim() || null)
      : null;
  const education = getDoctorEducation(doctor);
  const services = getDoctorServices(doctor);
  const categories = getDoctorCategories(doctor);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Сквозной декор smartcardio (ЭКГ + водяные знаки логотипа), как на главной.
          main прозрачный и лежит выше по z, поэтому декор просвечивает сквозь него. */}
      <BackgroundDecor id="doctor" position="fixed" />
      <Header />
      <main className="relative z-10 flex-1">
        <DoctorPageClient
          doctor={{
            id: doctor.id,
            name: doctor.name ?? null,
            email: doctor.email ?? null,
            price: doctor.price ?? null,
            experience: doctor.experience ?? null,
            degree: doctor.degree ?? null,
            bio: doctor.bio ?? null,
            slotDuration: doctor.slotDuration ?? null,
          }}
          photoUrl={photoUrl}
          specialty={specialty}
          organisation={organisation}
          education={education}
          services={services}
          categories={categories.map(c => ({ slug: c.slug }))}
          schedule={schedule}
        />
      </main>
      <Footer />
    </div>
  );
}
