"use client";

import { Activity, Wifi, FileCheck } from "lucide-react";

export function AutoEcgTransferSection() {
  return (
    <section className="py-12 sm:py-16 bg-white relative overflow-hidden">

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full text-xs font-bold tracking-[0.15em] uppercase text-primary border border-primary/20 bg-primary/5 backdrop-blur-sm mb-6 shadow-sm shadow-primary/10">
            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
            Наше преимущество
          </span>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-5 text-balance">
            Автоматическая передача{" "}
            <span className="gradient-text">данных ЭКГ</span>
          </h2>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed text-pretty">
            Записи, выполненные с помощью СмартКардио, автоматически доступны
            врачу во время консультации.
          </p>
        </div>

        {/* Video + Cards Layout */}
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Video Side */}
          <div className="relative">
            <div className="relative w-[55%] sm:w-[60%] lg:w-[64%] mx-auto">
              <video
                src="/chuck.webm"
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
                aria-label="Демонстрация работы прибора СмартКардио на смартфоне"
                className="w-full h-auto object-contain rounded-2xl"
              />
            </div>
          </div>

          {/* Cards Side */}
          <div className="flex flex-col gap-5">
            <div className="group p-6 rounded-2xl bg-card/70 backdrop-blur-sm border border-border/50 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300">
                <Activity className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                Запись ЭКГ
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Снимите кардиограмму в любое время с помощью прибора СмартКардио.
              </p>
            </div>

            <div className="group p-6 rounded-2xl bg-card/70 backdrop-blur-sm border border-border/50 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300">
                <Wifi className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                Мгновенная передача
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Данные автоматически синхронизируются и отправляются врачу.
              </p>
            </div>

            <div className="group p-6 rounded-2xl bg-card/70 backdrop-blur-sm border border-border/50 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300">
                <FileCheck className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                Анализ на консультации
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Врач изучает результаты прямо во время онлайн-приёма.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
