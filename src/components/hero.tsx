import Link from "next/link";
import Image from "next/image";
import { CheckCircle, Video, Clock, Shield, ArrowRight } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden py-20 sm:py-24">
      {/* Vibrant background with colorful gradient mesh */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-background" />
      <div className="absolute top-[-10%] left-[10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px]" />
      <div className="absolute top-[20%] right-[5%] w-[400px] h-[400px] bg-[oklch(0.65_0.22_260)] opacity-15 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-5%] left-[30%] w-[450px] h-[450px] bg-[oklch(0.60_0.20_340)] opacity-12 rounded-full blur-[110px]" />
      <div className="absolute top-[50%] right-[25%] w-[300px] h-[300px] bg-[oklch(0.55_0.25_290)] opacity-10 rounded-full blur-[90px]" />
      {/* Subtle animated floating orbs */}
      <div className="absolute top-[15%] left-[60%] w-32 h-32 bg-primary/25 rounded-full blur-2xl animate-pulse" />
      <div className="absolute bottom-[20%] right-[15%] w-24 h-24 bg-[oklch(0.60_0.20_340)] opacity-20 rounded-full blur-2xl animate-pulse [animation-delay:1s]" />
      {/* VideoLiner decorative background */}
      <Image
        src="/images/videoLiner.svg"
        alt=""
        width={755}
        height={821}
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 min-w-[600px] blur-[80px] opacity-90 -z-10 hidden md:block lg:min-w-[600px] md:min-w-[500px] md:-translate-x-[60%]"
        aria-hidden="true"
      />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="text-center space-y-8">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-semibold tracking-wide border border-primary/20">
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              Телемедицина нового поколения
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-foreground leading-[1.08] tracking-tight text-balance">
              Забота о здоровье —{" "}
              <span className="relative">
                <span className="bg-gradient-to-r from-[oklch(0.50_0.28_305)] via-[oklch(0.55_0.25_280)] to-[oklch(0.55_0.22_340)] bg-clip-text text-transparent">без дороги в поликлинику</span>
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" fill="none">
                  <defs>
                    <linearGradient id="underlineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="oklch(0.50 0.28 305)" stopOpacity="0.5" />
                      <stop offset="50%" stopColor="oklch(0.55 0.25 280)" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="oklch(0.55 0.22 340)" stopOpacity="0.5" />
                    </linearGradient>
                  </defs>
                  <path d="M2 10C50 4 150 2 298 10" stroke="url(#underlineGrad)" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-foreground/70 max-w-2xl mx-auto leading-relaxed font-medium">
              Ваш врач на расстоянии одного клика. 
              Профессиональные консультации <span className="text-foreground font-bold">кардиологов и терапевтов</span> без очередей и ожидания.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
            <Link
              href="/#categories"
              className="inline-flex items-center justify-center gap-2 text-base font-medium text-primary px-12 py-4 rounded-lg border-2 border-primary bg-background hover:bg-primary/5 shadow-sm transition-all md:px-16 lg:px-20"
            >
              Записаться на прием
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex items-center justify-center gap-2 text-base font-medium text-foreground/70 px-12 py-4 rounded-lg border border-border bg-background transition-all md:px-16 lg:px-20"
            >
              Узнать больше
            </Link>
          </div>

          <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 pt-6 lg:flex-nowrap">
            <div className="flex items-center gap-2.5 text-foreground/80">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle className="w-4.5 h-4.5 text-primary" />
              </div>
              <span className="text-sm font-medium">Лицензированные врачи</span>
            </div>
            <div className="flex items-center gap-2.5 text-foreground/80">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <Video className="w-4.5 h-4.5 text-primary" />
              </div>
              <span className="text-sm font-medium">Видеоконсультации</span>
            </div>
            <div className="flex items-center gap-2.5 text-foreground/80">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <Clock className="w-4.5 h-4.5 text-primary" />
              </div>
              <span className="text-sm font-medium">Доступно 24/7</span>
            </div>
            <div className="flex items-center gap-2.5 text-foreground/80">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="w-4.5 h-4.5 text-primary" />
              </div>
              <span className="text-sm font-medium">Конфиденциально</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
