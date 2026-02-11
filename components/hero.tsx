import Link from "next/link";
import Image from "next/image";
import { CheckCircle, Video, Clock, Shield, ArrowRight } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden py-12 sm:py-16">
      {/* Background with gradient mesh */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/8 via-background to-background" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-primary/4 rounded-full blur-3xl" />
      {/* VideoLiner decorative background */}
      <Image
        src="/images/videoLiner.svg"
        alt=""
        width={755}
        height={821}
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 min-w-[600px] blur-[100px] opacity-80 -z-10 hidden md:block lg:min-w-[600px] md:min-w-[500px] md:-translate-x-[60%]"
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
              Забота о сердце{" "}
              <span className="relative">
                <span className="text-primary">без границ</span>
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" fill="none">
                  <path d="M2 10C50 4 150 2 298 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-primary/40" />
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

          <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 pt-6">
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
