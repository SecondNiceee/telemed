import type { CSSProperties, ReactNode } from "react"
import { cn } from "@/lib/utils"

type BadgeTone = "primary" | "teal" | "onDark"

const TONE_CLASSES: Record<BadgeTone, string> = {
  // Как на smartcardio.ru: мягкая заливка бренда, без рамки и без тени
  primary: "bg-primary/10 text-primary",
  teal: "bg-teal/10 text-teal",
  onDark: "bg-teal-on-dark/15 text-teal-on-dark",
}

interface SectionBadgeProps {
  children: ReactNode
  tone?: BadgeTone
  className?: string
  style?: CSSProperties
}

/**
 * Пилюля-подзаголовок секции в стилистике smartcardio.ru:
 * 14px, вес 500, обычный регистр, мягкая заливка бренда.
 */
export function SectionBadge({
  children,
  tone = "primary",
  className,
  style,
}: SectionBadgeProps) {
  return (
    <span
      style={style}
      className={cn(
        "inline-flex w-fit items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
