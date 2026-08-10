import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
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
]

export function FaqSection(_props: FaqSectionProps) {
  const items = FAQ_ITEMS

  return (
    <section className="py-12 sm:py-16 bg-secondary/30" id="faq">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-[0.15em] uppercase text-primary border border-primary/20 bg-primary/5 mb-4">
            FAQ
          </span>
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
              className="border border-border/50 rounded-xl mb-3 bg-background px-6 data-[state=open]:shadow-sm"
            >
              <AccordionTrigger className="text-left text-base sm:text-lg font-semibold hover:no-underline py-5">
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
