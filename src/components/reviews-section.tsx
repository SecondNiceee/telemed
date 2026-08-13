import { Star } from "lucide-react";
import { SectionBadge } from "@/components/section-badge";

export function ReviewsSection() {
  return (
    <section id="reviews" className="py-8 sm:py-10 bg-background relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center">
          <SectionBadge tone="teal" className="mb-6">
            <Star className="w-4 h-4 fill-teal text-teal" aria-hidden="true" />
            Отзывы пациентов
          </SectionBadge>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-5">
            Что говорят наши пациенты
          </h2>
          <p className="text-muted-foreground text-lg sm:text-xl max-w-2xl mx-auto">
            Отзывы появятся после запуска платформы
          </p>
        </div>
      </div>
    </section>
  );
}
