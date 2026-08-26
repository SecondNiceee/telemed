import { cn } from "@/lib/utils"

interface UnreadDotProps {
  /**
   * Позиционирование задаёт вызывающий: точка absolute, поэтому родитель
   * обязан быть relative. Здесь же переопределяется цвет обводки — она должна
   * совпадать с фоном под точкой, иначе на тёмном баннере появляется светлый
   * ореол.
   */
  className?: string
  /** Текст для скринридера: визуально точка ничего не сообщает. */
  label?: string
}

/**
 * Точка «есть непрочитанное сообщение» на кнопке чата.
 *
 * Намеренно без числа: счёт непрочитанных в кабинете складывается из двух
 * источников (снимок из БД при рендере страницы и живые события сокета),
 * и точное совпадение чисел между ними не гарантировано. Факт «есть новое»
 * при этом надёжен — его и показываем.
 */
export function UnreadDot({ className, label = "Есть новое сообщение" }: UnreadDotProps) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-teal ring-2 ring-card",
        className,
      )}
    >
      <span className="sr-only">{label}</span>
    </span>
  )
}
