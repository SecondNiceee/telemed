"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getBasePath } from "@/lib/utils/basePath";

const features = [
  {
    image: "/ecg-features/leads.jpg",
    title: "6 отведений",
    description: "Полноценная кардиограмма как в клинике",
  },
  {
    image: "/ecg-features/sync.jpg",
    title: "Синхронизация",
    description: "Мгновенная передача данных врачу",
  },
  {
    image: "/ecg-features/precision.jpg",
    title: "Медицинская точность",
    description: "Сертифицированное медицинское устройство",
  },
  {
    image: "/ecg-features/speed.jpg",
    title: "Быстрый результат",
    description: "ЭКГ за 30 секунд в любом месте",
  },
];

export function EcgDeviceSection() {
  const basePath = getBasePath();

  return (
    <section className="py-12 sm:py-16 bg-background relative overflow-hidden">
      {/* Animated background */}
      <div
        className="absolute inset-0 animate-gradient opacity-50"
        style={{
          background:
            "linear-gradient(135deg, oklch(0.52 0.28 300 / 0.06) 0%, transparent 25%, oklch(0.58 0.25 320 / 0.04) 50%, transparent 75%, oklch(0.52 0.28 300 / 0.06) 100%)",
          backgroundSize: "400% 400%",
        }}
        aria-hidden="true"
      />

      {/* Floating blobs */}
      <div
        className="pointer-events-none absolute top-1/4 right-0 w-[500px] h-[500px] opacity-30 animate-blob"
        style={{
          background:
            "radial-gradient(circle, oklch(0.52 0.28 300 / 0.2) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute bottom-1/4 left-0 w-[400px] h-[400px] opacity-25 animate-blob"
        style={{
          background:
            "radial-gradient(circle, oklch(0.58 0.25 320 / 0.15) 0%, transparent 70%)",
          filter: "blur(60px)",
          animationDelay: "-5s",
        }}
        aria-hidden="true"
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full text-xs font-bold tracking-[0.15em] uppercase text-primary border border-primary/20 bg-primary/5 backdrop-blur-sm mb-6 shadow-sm shadow-primary/10">
            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
            Наше устройство
          </span>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-5 text-balance">
            Подробнее <span className="gradient-text">о приборе</span>
          </h2>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed text-pretty">
            Портативный кардиограф SmartCardio позволяет снять профессиональную
            электрокардиограмму в домашних условиях. Результаты мгновенно
            передаются вашему врачу для анализа и консультации.
          </p>
        </div>

        {/* Features grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group flex flex-col gap-4 rounded-2xl bg-card/70 backdrop-blur-sm border border-border/50 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1 overflow-hidden"
            >
              <div className="relative w-full aspect-[4/3] overflow-hidden bg-muted">
                <Image
                  src={`${basePath}${feature.image}` || `${basePath}/placeholder.svg`}
                  alt={feature.title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="flex items-start gap-4 p-6 pt-0">
                <div>
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA Button */}
        <div className="flex justify-center">
          <Button
            asChild
            size="lg"
            className="group h-14 px-8 text-base rounded-2xl shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
          >
            <Link
              href="https://smartcardio.ru/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Узнать больше о приборе
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
