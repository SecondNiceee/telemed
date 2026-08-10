"use client";

import Image from "next/image";

const ADVANTAGES = [
  {
    title: "Жалобы и изменения самочувствия",
    description: "Если появились симптомы, изменения состояния или вопросы, которые можно обсудить с врачом дистанционно.",
    image: "/images/telemedicine/complaints-headache.png",
  },
  {
    title: "Разбор обследований",
    description: "Интерпретация анализов, инструментальных, генетических исследований.",
    image: "/images/telemedicine/elderly-woman-ecg.png",
  },
  {
    title: "Второе медицинское мнение",
    description: "Если возникают сомнения в диагнозе, понимании результатов обследований или назначенном лечении.",
    image: "/images/telemedicine/doctor-video-call.png",
  },
  {
    title: "Наличие хронических заболеваний",
    description: "Динамическое наблюдение у профильного специалиста, оценка состояния и коррекция терапии без необходимости посещения клиники.",
    image: "/images/telemedicine/elderly-man-tablet.png",
  },
];

export function AdvantagesSection() {
  return (
    <section className="py-12 sm:py-16 bg-background relative overflow-hidden">
      {/* Animated background */}
      <div 
        className="absolute inset-0 animate-gradient opacity-40"
        style={{
          background: "linear-gradient(135deg, oklch(0.52 0.28 300 / 0.05) 0%, transparent 25%, oklch(0.58 0.25 320 / 0.03) 50%, transparent 75%, oklch(0.52 0.28 300 / 0.05) 100%)",
          backgroundSize: "400% 400%",
        }}
        aria-hidden="true"
      />

      {/* Floating blobs */}
      <div 
        className="absolute top-20 right-0 w-[500px] h-[500px] opacity-30 pointer-events-none animate-blob"
        style={{
          background: "radial-gradient(circle, oklch(0.52 0.28 300 / 0.15) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
        aria-hidden="true"
      />
      <div 
        className="absolute bottom-20 left-0 w-[400px] h-[400px] opacity-25 pointer-events-none animate-blob"
        style={{
          background: "radial-gradient(circle, oklch(0.58 0.25 320 / 0.12) 0%, transparent 70%)",
          filter: "blur(60px)",
          animationDelay: "-5s",
        }}
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold tracking-[0.15em] uppercase text-primary border border-primary/20 bg-primary/5 backdrop-blur-sm mb-6 shadow-sm shadow-primary/10">
            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
            Видеоконсультация с врачом
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-5">
            Кому подходит видеоконсультация с врачом?
          </h2>
          <p className="text-muted-foreground text-lg sm:text-xl max-w-2xl mx-auto">
            Дистанционные консультации для различных ситуаций
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {ADVANTAGES.map((advantage, index) => {
            return (
              <div
                key={index}
                className="group relative rounded-3xl border transition-all duration-500 hover:-translate-y-2 bg-card/50 backdrop-blur-sm border-border/60 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10 overflow-hidden"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {/* Image */}
                <div className="relative w-full aspect-[4/3] overflow-hidden">
                  <Image
                    src={advantage.image || "/placeholder.svg"}
                    alt={advantage.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                </div>

                {/* Content */}
                <div className="p-6">
                  <h3 className="relative text-lg font-semibold text-foreground mb-3 group-hover:text-primary transition-colors">
                    {advantage.title}
                  </h3>

                  <p className="relative text-sm text-muted-foreground leading-relaxed">
                    {advantage.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
