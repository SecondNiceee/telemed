import Link from "next/link";
import { ArrowRight, User } from "lucide-react";
import type { User as UserType } from "@/payload-types";
import { PhoneMockup } from "@/components/phone-mockup";

interface HeroProps {
  user?: UserType | null;
}

export function Hero({ user }: HeroProps) {
  return (
    <section className="relative overflow-hidden py-12 sm:py-16 lg:py-20 bg-background">
      {/* Animated gradient background */}
      <div 
        className="absolute inset-0 animate-gradient opacity-60"
        style={{
          background: "linear-gradient(135deg, oklch(0.52 0.28 300 / 0.08) 0%, oklch(0.58 0.25 320 / 0.05) 25%, transparent 50%, oklch(0.45 0.18 285 / 0.06) 75%, oklch(0.52 0.28 300 / 0.08) 100%)",
          backgroundSize: "400% 400%",
        }}
        aria-hidden="true"
      />

      {/* Animated blob shapes */}
      <div
        className="pointer-events-none absolute -top-20 -left-20 w-[500px] h-[500px] opacity-40 animate-blob animate-pulse-glow"
        style={{
          background: "radial-gradient(circle, oklch(0.52 0.28 300 / 0.25) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-1/3 -right-32 w-[400px] h-[400px] opacity-30 animate-blob animate-float-slow"
        style={{
          background: "radial-gradient(circle, oklch(0.58 0.25 320 / 0.3) 0%, transparent 70%)",
          filter: "blur(50px)",
          animationDelay: "-5s",
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute bottom-0 left-1/3 w-[350px] h-[350px] opacity-25 animate-blob"
        style={{
          background: "radial-gradient(circle, oklch(0.45 0.18 285 / 0.25) 0%, transparent 70%)",
          filter: "blur(50px)",
          animationDelay: "-3s",
        }}
        aria-hidden="true"
      />

      {/* Grid pattern overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage: `
            linear-gradient(to right, oklch(0.52 0.28 300 / 0.04) 1px, transparent 1px),
            linear-gradient(to bottom, oklch(0.52 0.28 300 / 0.04) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          maskImage: "radial-gradient(ellipse 70% 70% at 50% 50%, black 30%, transparent 100%)",
        }}
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          
          {/* Left side - Text content */}
          <div className="flex flex-col gap-6">
            <span 
              className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full text-xs font-bold tracking-[0.15em] uppercase text-primary border border-primary/20 bg-primary/5 backdrop-blur-sm w-fit animate-fade-up shadow-sm shadow-primary/10" 
              style={{ animationDelay: "0.05s" }}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              SmartCardio
            </span>

            <h1 
              className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold text-foreground leading-[1.05] tracking-[-0.03em] animate-fade-up" 
              style={{ animationDelay: "0.1s" }}
            >
              <span className="text-balance">Консультация с врачом</span>
              <br />
              <span className="gradient-text">онлайн</span>
            </h1>

            <p 
              className="text-lg sm:text-xl text-muted-foreground max-w-lg leading-relaxed animate-fade-up" 
              style={{ animationDelay: "0.15s" }}
            >
              Платформа дистанционного наблюдения и консультаций.
            </p>

            <div 
              className="flex flex-col sm:flex-row gap-4 pt-4 animate-fade-up" 
              style={{ animationDelay: "0.2s" }}
            >
              <Link
                href="/appointment"
                className="group inline-flex items-center justify-center gap-2.5 text-[15px] font-semibold text-primary-foreground bg-primary px-8 py-4 rounded-2xl shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
              >
                Записаться на приём
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              {user && (
                <Link
                  href="/lk"
                  className="group inline-flex items-center justify-center gap-2.5 text-[15px] font-semibold text-green-700 bg-green-50 px-8 py-4 rounded-2xl shadow-lg shadow-green-600/10 hover:shadow-xl hover:shadow-green-600/20 hover:bg-green-100 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 border border-green-200"
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
                  "radial-gradient(ellipse 55% 55% at 50% 45%, oklch(0.52 0.28 300 / 0.35) 0%, transparent 70%)",
                filter: "blur(50px)",
              }}
              aria-hidden="true"
            />
            <PhoneMockup src="/video/hero-video.mp4" className="animate-float-slow" />
          </div>

        </div>
      </div>
    </section>
  );
}
