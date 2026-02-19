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

  return (
    <BookingClient
      doctorId={doctor.id}
      doctorName={doctor.name || "Врач"}
      doctorPhoto={photoUrl}
      doctorSpecialty={specialty}
      doctorPrice={doctor.price ?? 0}
    />
  );
}
