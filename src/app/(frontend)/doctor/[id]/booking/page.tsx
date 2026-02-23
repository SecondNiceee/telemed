import { notFound } from "next/navigation";
import {
  fetchDoctorById,
  getDoctorSpecialty,
  ApiError,
  getErrorMessage,
  type ApiDoctor,
} from "@/lib/api/index";
import { resolveImageUrl } from "@/lib/utils/image";
import { Media } from "@/payload-types";
import { BookingClient } from "./booking-client";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { DoctorScheduleDate } from "@/lib/api/types";

interface BookingPageProps {
  params: Promise<{ id: string }>;
}

export default async function BookingPage({ params }: BookingPageProps) {
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

  const photoUrl = resolveImageUrl((doctor.photo as Media)?.url);
  const specialty = getDoctorSpecialty(doctor);

  // Filter schedule to only include future dates with slots
  const today = new Date().toISOString().split("T")[0];
  const schedule: DoctorScheduleDate[] = (doctor.schedule || [])
    .filter((s) => s.date >= today && s.slots && s.slots.length > 0)
    .map((s) => ({
      date: s.date,
      slots: s.slots || [],
      id: s.id,
    }));

  return (
    <BookingClient
      doctorId={doctor.id}
      doctorName={doctor.name || "Врач"}
      doctorPhoto={photoUrl}
      doctorSpecialty={specialty}
      doctorPrice={doctor.price ?? 0}
      schedule={schedule}
    />
  );
}
