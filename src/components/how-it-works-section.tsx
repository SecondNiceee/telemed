import { Activity, CloudUpload, Stethoscope, FileHeart, ArrowDown } from "lucide-react";

const STEPS = [
  {
    icon: Activity,
    title: "Запишите ЭКГ с помощью СмартКардио®",
    description: "Снимите кардиограмму в любое время и в любом месте — дома, на даче или в дороге.",
  },
  {
    icon: CloudUpload,
    title: "Данные автоматически загружаются в платформу",
    description: "Запись мгновенно передаётся в защищённое хранилище и привязывается к вашему профилю.",
  },
  {
    icon: Stethoscope,
    title: "Врач получает доступ к записи во время консультации",
    description: "Кардиолог видит актуальные данные ЭКГ прямо во время онлайн-приёма.",
  },
  {
    icon: FileHeart,
    title: "Рекомендации и наблюдение сохраняются в личном кабинете",
    description: "Заключения, назначения и динамика состояния всегда под рукой в вашем профиле.",
  },
];

export function HowItWorksSection() {
  return (
    <section className="py-12 sm:py-16 bg-background relative overflow-hidden">
      {/* Animated background */}
      <div
        className="absolute inset-0 animate-gradient opacity-50"
        style={{
          background:
            "linear-gradient(135deg, oklch(0.52 0.28 300 / 0.05) 0%, transparent 30%, oklch(0.58 0.25 320 / 0.04) 60%, transparent 100%)",
          backgroundSize: "400% 400%",
        }}
        aria-hidden="true"
      />

      {/* Floating blobs */}
      <div
        className="pointer-events-none absolute top-1/3 -left-32 w-[400px] h-[400px] opacity-25 animate-blob"
        style={{
          background: "radial-gradient(circle, oklch(0.52 0.28 300 / 0.2) 0%, transparent 70%)",
          filter: "blur(70px)",
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute bottom-0 -right-20 w-[350px] h-[350px] opacity-25 animate-blob"
        style={{
          background: "radial-gradient(circle, oklch(0.58 0.25 320 / 0.18) 0%, transparent 70%)",
          filter: "blur(60px)",
          animationDelay: "-4s",
        }}
        aria-hidden="true"
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-14">
          <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold tracking-[0.15em] uppercase text-primary border border-primary/20 bg-primary/5 backdrop-blur-sm mb-6 shadow-sm shadow-primary/10">
            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
            Процесс
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-5 text-balance">
            Как это работает
          </h2>
          <p className="text-muted-foreground text-lg sm:text-xl max-w-2xl mx-auto">
            Четыре простых шага от записи ЭКГ до консультации с врачом
          </p>
        </div>

        <ol className="flex flex-col items-stretch gap-4">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isLast = index === STEPS.length - 1;
            return (
              <li key={index} className="flex flex-col items-center">
                <div className="group relative w-full p-6 sm:p-7 rounded-3xl bg-card/70 backdrop-blur-sm border border-border/60 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10 transition-all duration-500 hover:-translate-y-1">
                  <div className="flex items-start gap-5 sm:gap-6">
                    {/* Icon with step number */}
                    <div className="relative flex-shrink-0">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300">
                        <Icon className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
                      </div>
                      <span className="absolute -top-2 -left-2 w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shadow-lg shadow-primary/30">
                        {index + 1}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0 pt-1">
                      <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2 group-hover:text-primary transition-colors text-pretty">
                        {step.title}
                      </h3>
                      <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>

                {!isLast && (
                  <div
                    className="flex items-center justify-center my-2"
                    aria-hidden="true"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <ArrowDown className="w-5 h-5 text-primary" />
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
