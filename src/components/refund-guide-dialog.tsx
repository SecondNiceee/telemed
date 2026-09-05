"use client"

import Link from "next/link"
import { MessageSquareText, LifeBuoy, RotateCcw } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface RefundGuideDialogProps {
  /** Id записи, чтобы кнопка «Написать врачу» открыла именно этот чат. */
  appointmentId: number
}

/**
 * Инструкция пациенту, как вернуть деньги за оплаченную консультацию.
 *
 * Кнопки отмены у пациента нет намеренно: возврат запускает врач, отметив
 * консультацию несостоявшейся (см. /api/appointments/:id/cancel). Пациенту
 * поэтому нужно объяснить два шага - написать врачу, а если врач не выходит
 * на связь, обратиться в поддержку. Текст согласован с разделом 7 оферты.
 */
export function RefundGuideDialog({ appointmentId }: RefundGuideDialogProps) {
  return (
    <Dialog>
      <DialogTrigger
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground underline decoration-border decoration-1 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary/40"
      >
        <RotateCcw className="size-3.5" aria-hidden="true" />
        Инструкция возврата
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Как вернуть деньги за консультацию</DialogTitle>
          <DialogDescription>
            Возврат запускает врач. Стоимость вернётся полностью на карту, с которой
            вы платили.
          </DialogDescription>
        </DialogHeader>

        <ol className="flex flex-col gap-4 py-2">
          <li className="flex gap-3.5">
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
            >
              <MessageSquareText className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Напишите врачу в чате записи</p>
              <p className="mt-1 text-pretty text-sm leading-relaxed text-muted-foreground">
                Сообщите, что консультация не нужна. Когда врач будет в сети, он отметит
                её как несостоявшуюся, и деньги вернутся автоматически. Причина не
                важна: технические неполадки, изменились планы или вы не смогли выйти
                на связь.
              </p>
              <Link
                href={`/lk/chat?appointment=${appointmentId}`}
                className="mt-2 inline-flex items-center rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Написать врачу
              </Link>
            </div>
          </li>

          <li className="flex gap-3.5">
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
            >
              <LifeBuoy className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                Врач не выходит на связь - напишите в поддержку
              </p>
              <p className="mt-1 text-pretty text-sm leading-relaxed text-muted-foreground">
                Если врач не появился в сети даже после времени начала консультации,
                откройте чат поддержки в правом нижнем углу сайта и укажите дату и
                время записи. Мы оформим возврат сами.
              </p>
            </div>
          </li>
        </ol>

        <p className="text-xs leading-relaxed text-muted-foreground">
          Зачисление на карту зависит от вашего банка: обычно от нескольких часов до 10
          дней. О возврате вы получите письмо на почту.
        </p>
      </DialogContent>
    </Dialog>
  )
}
