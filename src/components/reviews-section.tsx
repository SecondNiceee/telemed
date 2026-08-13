import { Star } from "lucide-react";

export function ReviewsSection() {
  return (
    <section className="py-8 sm:py-10 bg-gradient-to-b from-background via-secondary/20 to-background relative overflow-hidden">
      {/* Background decoration */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 50%, oklch(0.605 0.104 187 / 0.08), transparent)",
        }}
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center">
          <span className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full text-xs font-bold tracking-[0.15em] uppercase text-teal border border-teal/25 bg-teal/8 backdrop-blur-sm mb-6 shadow-sm shadow-teal/10">
            <Star className="w-3.5 h-3.5 fill-teal text-teal" />
            Отзывы пациентов
          </span>
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
