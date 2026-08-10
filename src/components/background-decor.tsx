/**
 * Фоновые декорации секции: точечная сетка, линии ЭКГ и водяной знак логотипа.
 * Не влияет на интерактивность (pointer-events-none) и скрыто от скринридеров.
 */
export function BackgroundDecor({ id = "decor" }: { id?: string }) {
  const patternId = `dot-grid-${id}`
  const ecgPath = "M0 40 H120 l10 0 6 -22 8 44 7 -52 6 60 7 -30 H210 l8 0 5 -12 5 12 H600"

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      <svg className="absolute inset-0 h-full w-full text-primary/[0.06]">
        <defs>
          <pattern id={patternId} x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.5" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>

      <svg
        className="absolute left-0 top-[14%] h-12 w-full text-primary/[0.09] md:h-16"
        viewBox="0 0 600 80"
        fill="none"
        preserveAspectRatio="none"
      >
        <path d={ecgPath} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <svg
        className="absolute left-0 top-1/2 h-10 w-full -translate-y-1/2 text-primary/[0.07] md:h-14"
        viewBox="0 0 600 80"
        fill="none"
        preserveAspectRatio="none"
      >
        <path d={ecgPath} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <svg
        className="absolute left-0 top-[82%] h-12 w-full text-primary/[0.08] md:h-16"
        viewBox="0 0 600 80"
        fill="none"
        preserveAspectRatio="none"
      >
        <path d={ecgPath} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/logo.jpg"
        alt=""
        className="absolute -right-6 bottom-[6%] h-24 w-auto opacity-[0.07] mix-blend-multiply md:h-32"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/logo.jpg"
        alt=""
        className="absolute -left-4 top-[8%] h-16 w-auto opacity-[0.06] mix-blend-multiply md:h-20"
      />
    </div>
  )
}
