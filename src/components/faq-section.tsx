import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { SectionBadge } from "@/components/section-badge"
import type { FaqItem } from "@/lib/api/site-settings"

interface FaqSectionProps {
  /** Оставлено для совместимости: список вопросов задан в коде ниже. */
  items?: FaqItem[]
}

const FAQ_ITEMS: { question: string; answer: string }[] = [
  {
    question: "С какими вопросами можно обратиться?",
    answer:
      "Вы можете обратиться, если хотите обсудить жалобы, результаты анализов и обследований, получить второе мнение, уточнить дальнейший план наблюдения или понять, нужен ли очный приём. Онлайн-формат особенно удобен для плановых консультаций и разбора уже имеющихся медицинских данных.",
  },
  {
    question: "Как подготовиться к консультации?",
    answer:
      "Заранее подготовьте список жалоб, принимаемых лекарств, диагнозов, перенесённых заболеваний и операций. Если у вас есть результаты ЭКГ, Холтера, УЗИ, анализов, выписки или заключения других специалистов, загрузите их в личный кабинет до консультации.",
  },
  {
    question: "Что я получу после консультации?",
    answer:
      "После консультации вы получите рекомендации врача и медицинское заключение в электронном виде, если это предусмотрено форматом услуги. Документ будет доступен в личном кабинете.",
  },
  {
    question: "Когда онлайн-консультация не подходит?",
    answer:
      "Онлайн-консультация не подходит при состояниях, требующих срочной медицинской помощи: например, сильная боль в груди, выраженная одышка, обморок, внезапная слабость или онемение, нарушение речи, резкое ухудшение самочувствия. В таких случаях нужно вызвать скорую помощь или обратиться в ближайшее медицинское учреждение.",
  },
  {
    question: "Нужно ли устанавливать приложение?",
    answer:
      "Консультация проходит онлайн через браузер. Устанавливать дополнительные программы не нужно: достаточно телефона, планшета или компьютера с камерой, микрофоном и доступом в интернет.",
  },
  {
    question: "Можно ли отменить консультацию, если уже оплатил?",
    answer:
      "Да. Напишите врачу в чате записи, что хотите отменить консультацию. Когда врач выйдет на связь, он отметит консультацию как несостоявшуюся, и деньги вернутся автоматически. Если врач не появляется в сети даже после назначенного времени, напишите в поддержку через чат в правом нижнем углу сайта — мы оформим возврат сами.",
  },
  {
    question: "Как происходит возврат средств?",
    answer:
      "Возврат всегда полный и приходит на ту же карту, с которой вы оплачивали. Он запускается автоматически, как только врач отмечает, что консультация не состоялась — по любой причине: технические неполадки, вы или врач не смогли выйти на связь, или вы сами попросили отменить. Срок зачисления зависит от вашего банка: обычно от нескольких часов до 10 дней. О возврате мы уведомим письмом.",
  },
]

export function FaqSection(_props: FaqSectionProps) {
  const items = FAQ_ITEMS

  return (
    <section className="relative overflow-hidden py-8 sm:py-10 bg-secondary/30" id="faq">
      {/* Тонкий точечный узор — как на референсе, без линий ЭКГ и водяных знаков */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(oklch(0.4989 0.1406 299.8 / 0.09) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          maskImage:
            "radial-gradient(ellipse 75% 70% at 50% 40%, black 0%, transparent 80%)",
        }}
        aria-hidden="true"
      />
      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <SectionBadge tone="teal" className="mb-3">
            FAQ
          </SectionBadge>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Часто задаваемые вопросы
          </h2>
          <p className="text-muted-foreground text-lg">
            Ответы на популярные вопросы о нашем сервисе
          </p>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {items.map((item, index) => (
            <AccordionItem
              key={item.question}
              value={`item-${index}`}
              className="sc-card border-0 mb-3 bg-background px-6"
            >
              <AccordionTrigger className="text-left text-base sm:text-lg font-semibold hover:no-underline py-5 data-[state=open]:text-primary [&>svg]:text-teal">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-base leading-relaxed">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
