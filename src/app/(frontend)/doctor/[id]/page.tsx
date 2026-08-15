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
import {
  getFreshDoctorSchedule,
  releaseExpiredHolds,
} from "@/lib/server/appointment-holds";
import { DoctorPageClient } from "./doctor-page-client";

export const dynamic = 'force-dynamic';

interface DoctorPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: DoctorPageProps) {
  const { id } = await params;

  try {
    const doctor = await fetchDoctorById(id);
    const specialty = getDoctorSpecialty(doctor);
    return {
      title: `${doctor.name} - smartcardio`,
      description: `Профиль врача ${doctor.name} - ${specialty}`,
    };
  } catch {
    return {
      title: "Врач - smartcardio",
      description: "Профиль врача",
    };
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

  // Просроченные неоплаченные брони освобождаем прямо при заходе на страницу
  // (внешний cron не нужен) и читаем расписание напрямую из БД, минуя кеш,
  // чтобы освободившиеся слоты сразу были видны.
  const releasedCount = await releaseExpiredHolds({ doctorId: doctor.id });
  const schedule = releasedCount > 0
    ? await getFreshDoctorSchedule(doctor.id)
    : (doctor.schedule ?? []);

  const photoUrl = (doctor.photo as Media)?.url ?? null;
  const specialty = getDoctorSpecialty(doctor);
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
