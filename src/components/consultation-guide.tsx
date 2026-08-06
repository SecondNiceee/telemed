"use client";

import { Card, CardContent } from "@/components/ui/card";
import { 
  FileUp,
  MessageCircle,
  FileCheck,
  X,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ApiAppointment } from "@/lib/api/types";

interface ConsultationGuideProps {
  appointment: ApiAppointment;
}

const steps = [
  {
    num: 1,
    icon: FileUp,
    title: "Загрузите документы",
    description: "Прикрепите анализы, ЭКГ и другие файлы",
  },
  {
    num: 2,
    icon: MessageCircle,
    title: "Перейдите в чат",
    description: "Опишите жалобы и задайте вопросы врачу",
  },
  {
    num: 3,
    icon: FileCheck,
    title: "Получите заключение",
    description: "Врач отправит рекомендации в чат",
  },
];

export function ConsultationGuide({ appointment }: ConsultationGuideProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  const isUpcoming = appointment.status === "confirmed";
  const isActive = appointment.status === "in_progress";

  // Only show for upcoming or active consultations
  if (!isUpcoming && !isActive) return null;

  return (
    <Card className="mb-6 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5 shadow-sm">
      <CardContent className="py-5 px-5">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h3 className="font-semibold text-base text-foreground">
            Порядок получения консультации
          </h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground flex-shrink-0"
            onClick={() => setIsDismissed(true)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {steps.map((step, index) => (
            <div
              key={step.num}
              className="flex items-start gap-3 p-4 rounded-xl bg-card border border-border/50 hover:border-primary/30 hover:shadow-sm transition-all"
            >
              <div className="relative flex-shrink-0">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <step.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-[10px] font-bold text-primary-foreground">{step.num}</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-foreground leading-tight mb-0.5">
                  {step.title}
                </p>
                <p className="text-xs text-muted-foreground leading-snug">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
