import Image from "next/image";
import { SectionBadge } from "@/components/section-badge";

const ADVANTAGES: {
  title: string;
  description: string;
  image: string;
}[] = [
  {
    title: "Жалобы и изменения самочувствия",
    description:
      "Если появились симптомы, изменения состояния или вопросы, которые можно обсудить с врачом дистанционно.",
    image: "/images/telemedicine/complaints-headache.png",
  },
  {
    title: "Разбор обследований",
    description:
      "Интерпретация анализов, инструментальных, генетических исследований.",
    image: "/images/telemedicine/elderly-woman-ecg.png",
  },
  {
    title: "Второе медицинское мнение",
    description:
      "Если возникают сомнения в диагнозе, понимании результатов обследований или назначенном лечении.",
    image: "/images/telemedicine/doctor-video-call.png",
  },
  {
    title: "Наличие хронических заболеваний",
    description:
      "Динамическое наблюдение у профильного специалиста, оценка состояния и коррекция терапии без необходимости посещения клиники.",
    image: "/images/telemedicine/elderly-man-tablet.png",
  },
];

export function AdvantagesSection() {
  return (
    <section id="advantages" className="relative overflow-hidden bg-surface-dark py-14 sm:py-20">
      {/* Тонкий точечный узор — единственный декор, как на референсе */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(oklch(1 0 0 / 0.07) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 0%, black 0%, transparent 80%)",
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <SectionBadge tone="onDark" className="mb-6">
            Видеоконсультация с врачом
          </SectionBadge>
          <h2 className="mb-5 text-balance text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
            Кому подходит видеоконсультация с врачом?
          </h2>
          <p className="mx-auto max-w-2xl text-pretty text-lg text-white/65 sm:text-xl">
            Дистанционные консультации для различных ситуаций
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {ADVANTAGES.map((advantage) => (
            <article
              key={advantage.title}
              className="sc-card-dark group overflow-hidden"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden">
                <Image
                  src={advantage.image || "/placeholder.svg"}
                  alt={advantage.title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div
                  className="absolute inset-0 bg-gradient-to-t from-surface-dark-elevated via-surface-dark-elevated/20 to-transparent"
                  aria-hidden="true"
                />
              </div>

              <div className="flex flex-col gap-2 p-6">
                <h3 className="text-pretty text-lg font-semibold text-white">
                  {advantage.title}
                </h3>

                <p className="text-sm leading-relaxed text-white/60">
                  {advantage.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
