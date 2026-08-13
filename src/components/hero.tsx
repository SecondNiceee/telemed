import Link from "next/link";
import { ArrowRight, User } from "lucide-react";
import type { User as UserType } from "@/payload-types";
import { PhoneMockup } from "@/components/phone-mockup";
import { SectionBadge } from "@/components/section-badge";

interface HeroProps {
  user?: UserType | null;
}

export function Hero({ user }: HeroProps) {
  return (
    <section className="relative overflow-hidden py-8 sm:py-10 lg:py-14 bg-background">
      {/* Чистый фон как на референсе: тонкий точечный узор без градиентов и блобов */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(oklch(0.4989 0.1406 299.8 / 0.10) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          maskImage:
            "radial-gradient(ellipse 65% 60% at 30% 40%, black 0%, transparent 75%)",
        }}
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          
          {/* Left side - Text content */}
          <div className="flex flex-col gap-6">
            <SectionBadge
              tone="teal"
              className="animate-fade-up"
              style={{ animationDelay: "0.05s" }}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal"></span>
              </span>
              SmartCardio
            </SectionBadge>

            <h1 
              className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold text-foreground leading-[1.05] tracking-[-0.03em] animate-fade-up" 
              style={{ animationDelay: "0.1s" }}
            >
              <span className="block whitespace-nowrap">Консультация с</span>
              <span className="block whitespace-nowrap">
                врачом <span className="gradient-text">онлайн</span>
              </span>
            </h1>

            <p 
              className="text-lg sm:text-xl text-muted-foreground max-w-lg leading-relaxed animate-fade-up" 
              style={{ animationDelay: "0.15s" }}
            >
              Консультация врача, когда и где вам удобно. Просто выберите специалиста, забронируйте время - и общайтесь по видео.
            </p>

            <div 
              className="flex flex-col sm:flex-row gap-4 pt-4 animate-fade-up" 
              style={{ animationDelay: "0.2s" }}
            >
              <Link
                href="/appointment"
                className="group inline-flex items-center justify-center gap-2.5 text-[15px] font-semibold text-primary-foreground bg-primary px-8 py-4 rounded-lg shadow-sm shadow-primary/20 hover:bg-primary/90 hover:shadow-md hover:shadow-primary/25 active:scale-[0.99] transition-all duration-200"
              >
                Записаться на приём
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              {user && (
                <Link
                  href="/lk"
                  className="group inline-flex items-center justify-center gap-2.5 text-[15px] font-semibold text-teal bg-teal/10 px-8 py-4 rounded-lg hover:bg-teal hover:text-teal-foreground active:scale-[0.99] transition-all duration-200"
                >
                  <User className="w-4 h-4" />
                  Личный кабинет
                </Link>
              )}
            </div>

          </div>

          {/* Right side - Phone mockup with video */}
          <div className="relative flex justify-center animate-fade-up" style={{ animationDelay: "0.3s" }}>
            {/* Свечение за телефоном */}
            <div
              className="pointer-events-none absolute inset-0 -z-10"
              style={{
                background:
                  "radial-gradient(ellipse 55% 55% at 50% 45%, oklch(0.6273 0.1067 201.3 / 0.14) 0%, oklch(0.4989 0.1406 299.8 / 0.10) 45%, transparent 72%)",
                filter: "blur(60px)",
              }}
              aria-hidden="true"
            />
            <PhoneMockup src="/video/hero-video.mp4" />
          </div>

        </div>
      </div>
    </section>
  );
}
