"use client"

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Timer, User } from "lucide-react";
import { ApiDoctor, getDoctorSpecialty } from "@/lib/api/index";
import { Media } from "@/payload-types";
import { useRouter } from "next/navigation";
import { getConsultationDurationLabel } from "@/lib/utils/consultation-duration";

interface DoctorCardProps {
  doctor: ApiDoctor;
}

export function DoctorCard({ doctor }: DoctorCardProps) {
  const specialty = getDoctorSpecialty(doctor);
  const router = useRouter();
  // null, если у врача нет ни одного слота — тогда длительность не показываем.
  const consultationDuration = getConsultationDurationLabel(doctor);

  return (
    <div onClick={() => router.push(`/doctor/${doctor.id}`)} className="block">
      <Card className="group py-0 overflow-hidden hover:shadow-xl transition-all duration-300 hover:border-primary/30 border-transparent shadow-sm cursor-pointer hover:scale-[1.02]">
        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row sm:items-stretch">
            {/* Квадрат: фото уже обрезано 1:1 в админке, поэтому кадр не искажается */}
            <div className="relative w-full sm:w-48 aspect-square flex-shrink-0">
              {(doctor?.photo as Media)?.url ? (
                <img
                  src={(doctor?.photo as Media)?.url ?? "/placeholder.svg"}
                  alt={doctor.name || "Врач"}
                  className="w-full h-full object-cover absolute inset-0"
                />
              ) : (
                <div className="w-full h-full absolute inset-0 bg-muted flex items-center justify-center">
                  <User className="w-16 h-16 text-muted-foreground/50" />
                </div>
              )}
            </div>
            
            <div className="flex-1 my-5 flex flex-col px-5 py-1 justify-center">
              <div className="flex-1 flex flex-col justify-center">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                      {doctor.name || "Без имени"}
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      {specialty}
                    </p>
                    {doctor.degree && (
                      <p className="text-xs text-primary font-medium mt-1">
                        {doctor.degree}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-3">
                  {doctor.experience != null && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>Стаж {doctor.experience} лет</span>
                    </div>
                  )}
                  {consultationDuration && (
                    <div className="flex items-center gap-1">
                      <Timer className="w-4 h-4 text-primary" />
                      <span>Консультация {consultationDuration}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border">
                <div>
                  {doctor.price != null && (
                    <span className="text-xl font-bold text-foreground">
                      {doctor.price.toLocaleString("ru-RU")} ₽
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="border-primary text-primary hover:bg-primary/5 transition-all"
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  >
                    {/* Роута /doctor/{id}/booking не существует — он давал 404.
                        Форма записи живёт на самой странице врача. */}
                    <Link
                      href={`/doctor/${doctor.id}`}
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    >
                      Записаться
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
