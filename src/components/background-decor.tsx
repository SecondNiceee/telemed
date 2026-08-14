/**
 * Фоновые декорации: точечная сетка, линии ЭКГ и водяной знак логотипа.
 * Не влияет на интерактивность (pointer-events-none) и скрыто от скринридеров.
 *
 * position="absolute" — декор внутри одной секции (секция должна быть relative).
 * position="fixed"    — сквозной декор на всю страницу (как на smartcardio.ru):
 *                       слой лежит под контентом и не скроллится, поэтому секции
 *                       поверх него должны быть прозрачными.
 */
export function BackgroundDecor({
  id = "decor",
  position = "absolute",
}: {
  id?: string
  position?: "absolute" | "fixed"
}) {
  const patternId = `dot-grid-${id}`
  const ecgPath = "M0 40 H120 l10 0 6 -22 8 44 7 -52 6 60 7 -30 H210 l8 0 5 -12 5 12 H600"

  return (
    <div
      className={`pointer-events-none ${position} inset-0 z-0 overflow-hidden`}
      aria-hidden="true"
    >
      <svg className="absolute inset-0 h-full w-full text-primary/[0.04]">
        <defs>
          <pattern id={patternId} x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.5" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>

      <svg
        className="absolute left-0 top-[14%] h-12 w-full text-primary/[0.07] md:h-16"
        viewBox="0 0 600 80"
        fill="none"
        preserveAspectRatio="none"
      >
        <path d={ecgPath} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <svg
        className="absolute left-0 top-1/2 h-10 w-full -translate-y-1/2 text-teal/[0.09] md:h-14"
        viewBox="0 0 600 80"
        fill="none"
        preserveAspectRatio="none"
      >
        {/* Комплекс сдвинут к центру */}
        <path
          d={ecgPath}
          transform="translate(180 0)"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M0 40 H180" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <svg
        className="absolute left-0 top-[82%] h-12 w-full text-primary/[0.06] md:h-16"
        viewBox="0 0 600 80"
        fill="none"
        preserveAspectRatio="none"
      >
        {/* Комплекс сдвинут вправо */}
        <path
          d={ecgPath}
          transform="translate(360 0)"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M0 40 H360" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>

      {/* Водяные знаки логотипа. В тёмной теме инвертируем jpg и подмешиваем
          через lighten, чтобы белая подложка картинки не давала светлый квадрат. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/logo.jpg"
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute -right-6 bottom-[6%] h-24 w-auto opacity-[0.06] mix-blend-multiply md:h-32 dark:opacity-[0.035] dark:mix-blend-lighten dark:invert"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/logo.jpg"
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute -left-4 top-[8%] h-16 w-auto opacity-[0.05] mix-blend-multiply md:h-20 dark:opacity-[0.03] dark:mix-blend-lighten dark:invert"
      />
    </div>
  )
}
