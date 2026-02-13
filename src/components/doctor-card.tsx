import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import type { ApiDoctor } from "@/lib/api/index";
import { getDoctorPhotoUrl, getDoctorSpecialty } from "@/lib/api/index";

interface DoctorCardProps {
  doctor: ApiDoctor;
}

export function DoctorCard({ doctor }: DoctorCardProps) {
  const photoUrl = getDoctorPhotoUrl(doctor);
  const specialty = getDoctorSpecialty(doctor);

  return (
    <Card className="group overflow-hidden hover:shadow-xl transition-all duration-300 hover:border-primary/30 border-transparent shadow-sm">
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row sm:items-stretch">
          <div className="relative w-full sm:w-40 h-52 sm:h-auto flex-shrink-0">
            <img
              src={photoUrl || "/placeholder.svg"}
              alt={doctor.name || "Врач"}
              className="w-full h-full object-cover absolute inset-0"
            />
          </div>
          
          <div className="flex-1 flex flex-col px-5 py-4 justify-center">
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
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/doctor/${doctor.id}`}>Профиль</Link>
                </Button>
                <Button variant="outline" size="sm" asChild className="border-primary text-primary hover:bg-primary/5 transition-all">
                  <Link href={`/doctor/${doctor.id}/booking`}>Записаться</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
