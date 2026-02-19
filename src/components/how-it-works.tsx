import Image from "next/image";
import { UserSearch, CalendarCheck, Video, FileText } from "lucide-react";
import { resolveImageUrl } from "@/lib/utils/image";

const steps = [
  {
    icon: UserSearch,
    title: "Выберите врача",
    description: "Найдите специалиста по категории, рейтингу и отзывам пациентов",
  },
  {
    icon: CalendarCheck,
    title: "Запишитесь на прием",
    description: "Выберите удобную дату и время в календаре доступных слотов",
  },
  {
    icon: Video,
    title: "Получите консультацию",
    description: "Подключитесь к видеозвонку в назначенное время из любого места",
  },
  {
    icon: FileText,
    title: "Получите рекомендации",
    description: "Врач отправит заключение и рекомендации в личный кабинет",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-8 sm:py-10 bg-secondary/30 relative overflow-hidden">
      {/* Decorative blurred logo marks */}
      <img
        src={resolveImageUrl(`/images/logo.jpg`)}
        alt=""
        width={1200}
        height={1006}
        className="pointer-events-none absolute blur-[25px] opacity-30 w-[15%] h-auto left-[5%] top-[10%] hidden md:block"
        aria-hidden="true"
      />
      <img
        src="/images/logo.jpg"
        alt=""
        width={1200}
        height={1006}
        className="pointer-events-none absolute blur-[25px] opacity-30 w-[15%] h-auto right-[5%] bottom-[10%] hidden md:block"
        aria-hidden="true"
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Как это работает
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Четыре простых шага до консультации с врачом
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <div key={step.title} className="relative">
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-6">
                  <div className="w-16 h-16 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center text-primary">
                    <step.icon className="w-8 h-8" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-background rounded-full flex items-center justify-center text-primary font-bold text-sm shadow-md ring-2 ring-primary/20">
                    {index + 1}
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {step.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>
              
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-[calc(50%+40px)] w-[calc(100%-80px)] h-0.5 bg-border" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
