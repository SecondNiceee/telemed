import Link from "next/link";
import { CheckCircle, Video, Clock, Shield, ArrowRight } from "lucide-react";

const BADGES = [
  { icon: CheckCircle, label: "Лицензированные врачи" },
  { icon: Video, label: "Видеоконсультации" },
  { icon: Clock, label: "Доступно 24/7" },
  { icon: Shield, label: "Конфиденциально" },
];

interface HeroProps {
  title?: string;
  subtitle?: string;
}

export function Hero({ title, subtitle }: HeroProps) {
  const displayTitle = title || "Забота о здоровье — без дороги в поликлинику";
  const displaySubtitle = subtitle || "Ваш врач на расстоянии одного клика. Профессиональные консультации кардиологов и терапевтов без очередей и ожидания.";

  return (
    <section className="relative overflow-hidden py-18  bg-gradient-to-b from-primary/5 via-background to-background">
      {/* Decorative blurred shapes */}
      <div
        className="pointer-events-none absolute top-0 left-1/4 w-[500px] h-[500px] opacity-30"
        style={{
          background: "radial-gradient(circle, oklch(0.55 0.20 280 / 0.4) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-20 right-1/4 w-[400px] h-[400px] opacity-25"
        style={{
          background: "radial-gradient(circle, oklch(0.60 0.25 320 / 0.35) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
        aria-hidden="true"
      />
      
      {/* Subtle grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: `
            linear-gradient(to right, oklch(0.50 0.15 305 / 0.06) 1px, transparent 1px),
            linear-gradient(to bottom, oklch(0.50 0.15 305 / 0.06) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 30%, black 20%, transparent 100%)",
        }}
        aria-hidden="true"
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="text-center flex flex-col items-center gap-8">

          {/* Live badge */}
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-[0.18em] uppercase text-primary border border-primary/25 bg-primary/8 shadow-sm animate-fade-up" style={{ animationDelay: "0.05s" }}>
            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
            Телемедицина нового поколения
          </span>

          {/* Heading */}
          <h1 className="text-4xl sm:text-5xl lg:text-[66px] font-extrabold text-foreground leading-[1.04] tracking-[-0.035em] text-balance animate-fade-up" style={{ animationDelay: "0.1s" }}>
            {displayTitle.includes("—") ? (
              <>
                {displayTitle.split("—")[0]}—{" "}
                <span className="relative inline-block">
                  <span className="text-primary">{displayTitle.split("—")[1]?.trim()}</span>
                  <svg
                    className="absolute -bottom-2 left-0 w-full text-primary/35"
                    viewBox="0 0 380 10"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M2 8C70 3 220 1 378 8"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </>
            ) : (
              <span className="text-primary">{displayTitle}</span>
            )}
          </h1>

          {/* Subheading */}
          <p className="text-lg sm:text-xl text-foreground/55 max-w-2xl leading-relaxed animate-fade-up" style={{ animationDelay: "0.15s" }}>
            {displaySubtitle}
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-3 animate-fade-up" style={{ animationDelay: "0.2s" }}>
            <Link
              href="/#categories"
              className="inline-flex items-center justify-center gap-2 text-[15px] font-semibold text-primary-foreground bg-primary px-8 py-3.5 rounded-xl shadow-lg shadow-primary/20 hover:brightness-110 hover:shadow-primary/35 transition-all duration-200"
            >
              Записаться на приём
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex items-center justify-center gap-2 text-[15px] font-medium text-foreground/65 px-8 py-3.5 rounded-xl border border-border bg-background hover:bg-secondary/50 transition-all duration-200"
            >
              Узнать больше
            </Link>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 pt-2 animate-fade-up" style={{ animationDelay: "0.25s" }}>
            {BADGES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2.5 text-foreground/55">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-primary" strokeWidth={2} />
                </div>
                <span className="text-sm font-medium">{label}</span>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
