import { notFound } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
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
import { resolveImageUrl } from "@/lib/utils/image";
import { Media } from "@/payload-types";
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
        <Header />
        <main className="flex-1 flex items-center justify-center bg-background">
          <div className="text-center px-4">
            <p className="text-destructive text-lg mb-4">{error || "Врач не найден"}</p>
            <Button variant="outline" asChild className="border-primary text-primary hover:bg-primary/5 transition-all">
              <Link href="/#categories">На главную</Link>
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const doctorPhotoUrl = (doctor.photo as Media)?.url;
  const photoUrl = doctorPhotoUrl ? resolveImageUrl(doctorPhotoUrl) : null;
  const specialty = getDoctorSpecialty(doctor);
  const education = getDoctorEducation(doctor);
  const services = getDoctorServices(doctor);
  const categories = getDoctorCategories(doctor);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-gradient-to-b from-primary/5 via-background to-background">
        <DoctorPageClient
          doctor={{
            id: doctor.id,
            name: doctor.name ?? null,
            email: doctor.email ?? null,
            price: doctor.price ?? null,
            experience: doctor.experience ?? null,
            degree: doctor.degree ?? null,
            bio: doctor.bio ?? null,
          }}
          photoUrl={photoUrl}
          specialty={specialty}
          education={education}
          services={services}
          categories={categories.map(c => ({ slug: c.slug }))}
          schedule={doctor.schedule ?? []}
        />
      </main>
      <Footer />
    </div>
  );
}
