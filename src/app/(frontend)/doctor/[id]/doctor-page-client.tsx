"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  GraduationCap,
  Video,
  Shield,
  Award,
  CheckCircle,
  User,
} from "lucide-react";
import { DoctorReviews } from "@/components/doctor-reviews";
import { DoctorBookingSection } from "@/components/doctor-booking-section";
import type { DoctorScheduleDate } from "@/lib/api/types";

interface DoctorPageClientProps {
  doctor: {
    id: number;
    name: string | null;
    email: string;
    price: number | null;
    experience: number | null;
    degree: string | null;
    bio: string | null;
  };
  photoUrl: string | null;
  specialty: string;
  education: string[];
  services: string[];
  categories: { slug: string }[];
  schedule: DoctorScheduleDate[];
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

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link href={firstCategorySlug ? `/category/${firstCategorySlug}` : "/#categories"}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Назад к списку врачей
        </Link>
      </Button>

      {/* Booking Section - at top */}
      <div className="mb-4">
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

      {/* Doctor Header */}
      <Card className="mb-2 py-0 px-0 overflow-hidden">
        <CardContent className="py-0 px-0">
          <div className="flex flex-col py-0 md:flex-row gap-3 md:items-stretch">
            <div className="w-full md:w-80 h-72 md:h-auto flex-shrink-0 relative">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={doctor.name || "Врач"}
                  className="w-full h-full object-cover absolute inset-0"
                />
              ) : (
                <div className="w-full h-full absolute inset-0 bg-muted flex items-center justify-center">
                  <User className="w-24 h-24 text-muted-foreground/50" />
                </div>
              )}
            </div>

            <div className="flex-1 px-6 py-6 text-center md:text-left flex flex-col justify-center">
              <div className="mb-1 gap-2 flex flex-col">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                  {doctor.name}
                </h1>
                <p className="text-lg text-primary">{specialty}</p>
              </div>

              <div className="flex flex-col gap-1 text-sm mb-4">
                {doctor.experience != null && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-base">Стаж:</span>
                    <span className="font-medium text-foreground text-base">{doctor.experience} лет</span>
                  </div>
                )}
                {doctor.price != null && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-base">Стоимость консультации:</span>
                    <span className="font-medium text-foreground text-base">{doctor.price.toLocaleString("ru-RU")} ₽</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* About */}
      {doctor.bio && (
        <Card className="mb-2">
          <CardContent className="px-6 py-0">
            <h2 className="text-lg font-semibold text-foreground mb-0.5">
              О враче :
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {doctor.bio}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Degree */}
      {doctor.degree && (
        <Card className="mb-2">
          <CardContent className="px-6 py-0">
            <h2 className="text-lg font-semibold text-foreground mb-0.5 flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              Степень :
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {doctor.degree}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Education */}
      {education.length > 0 && (
        <Card className="mb-2">
          <CardContent className="px-6 py-0">
            <h2 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-primary" />
              Образование :
            </h2>
            {education.length === 1 ? (
              <p className="text-muted-foreground text-sm leading-relaxed">
                {education[0]}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {education.map((edu, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span>{edu}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* Services */}
      {services.length > 0 && (
        <Card className="mb-2">
          <CardContent className="px-6 flex flex-col py-0">
            <h2 className="text-lg font-semibold text-foreground mb-3">
              Услуги :
            </h2>
            <div className="grid sm:grid-cols-2 gap-1.5">
              {services.map((service, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 px-3 py-2 bg-secondary/50 rounded-lg"
                >
                  <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-foreground text-sm">{service}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Features */}
      <div className="grid sm:grid-cols-3 gap-1.5 mb-2">
        <Card className="py-4 sm:py-6">
          <CardContent className="px-5 py-0 flex items-center gap-2">
            <div className="w-10 h-10 bg-primary/10 rounded-md flex items-center justify-center flex-shrink-0">
              <Video className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm text-foreground leading-tight">Видеоконсультация</p>
              <p className="text-xs text-muted-foreground leading-tight">HD качество</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-4 sm:py-6">
          <CardContent className="px-5 py-0 flex items-center gap-2">
            <div className="w-10 h-10 bg-primary/10 rounded-md flex items-center justify-center flex-shrink-0">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm text-foreground leading-tight">Конфиденциально</p>
              <p className="text-xs text-muted-foreground leading-tight">Защита данных</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-4 sm:py-6">
          <CardContent className="px-5 py-0 flex items-center gap-2">
            <div className="w-10 h-10 bg-primary/10 rounded-md flex items-center justify-center flex-shrink-0">
              <Award className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm text-foreground leading-tight">Сертифицирован</p>
              <p className="text-xs text-muted-foreground leading-tight">Все лицензии</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reviews Section */}
      <DoctorReviews doctorId={doctor.id} doctorName={doctor.name || 'Врач'} />
    </div>
  );
}
