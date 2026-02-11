import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, Clock } from "lucide-react";
import type { Doctor } from "@/lib/data";

interface DoctorCardProps {
  doctor: Doctor;
}

export function DoctorCard({ doctor }: DoctorCardProps) {
  return (
    <Card className="group overflow-hidden hover:shadow-xl transition-all duration-300 hover:border-primary/30 border-transparent shadow-sm">
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row sm:items-stretch">
          <div className="relative w-full sm:w-40 h-52 sm:h-auto flex-shrink-0">
            <img
              src={doctor.photo || "/placeholder.svg"}
              alt={doctor.name}
              className="w-full h-full object-cover absolute inset-0"
            />
          </div>
          
          <div className="flex-1 flex flex-col px-5 py-4 justify-center">
            <div className="flex-1 flex flex-col justify-center">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                    {doctor.name}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {doctor.specialty}
                  </p>
                  <p className="text-xs text-primary font-medium mt-1">
                    {doctor.degree}
                  </p>
                </div>
                <div className="flex items-center gap-1 bg-accent/10 px-2 py-1 rounded-lg">
                  <Star className="w-4 h-4 text-accent fill-accent" />
                  <span className="text-sm font-medium text-foreground">
                    {doctor.rating}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-3">
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>Стаж {doctor.experience} лет</span>
                </div>
                <span>{doctor.reviewsCount} отзывов</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border">
              <div>
                <span className="text-xl font-bold text-foreground">
                  {doctor.price.toLocaleString("ru-RU")} ₽
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/doctor/${doctor.id}`}>Профиль</Link>
                </Button>
                <Button size="sm" asChild className="bg-gradient-to-r from-[#40f] to-[#ff00d9] text-primary-foreground border-0 hover:brightness-110 transition-all">
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
