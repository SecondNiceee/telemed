"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

interface PhoneMockupProps {
  src: string;
  poster?: string;
  className?: string;
}

/**
 * Качественный мокап смартфона с видео внутри.
 * Собран на CSS-слоях: титановый корпус, фаска, тень, стекло,
 * Dynamic Island, боковые кнопки, блик и home-indicator.
 */
export function PhoneMockup({ src, poster, className }: PhoneMockupProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  // Гарантируем автозапуск после гидратации (Safari/iOS)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    const play = video.play();
    if (play && typeof play.catch === "function") {
      play.catch(() => {
        /* автозапуск заблокирован — оставляем постер */
      });
    }
  }, []);

  const toggleSound = () => {
    const video = videoRef.current;
    if (!video) return;
    const next = !muted;
    video.muted = next;
    if (!next) {
      void video.play().catch(() => undefined);
    }
    setMuted(next);
  };

  return (
    <div className={className}>
      {/* Внешний корпус (титановая рамка) */}
      <div
        className="relative mx-auto w-[240px] sm:w-[270px] lg:w-[290px] aspect-[1/2.03] rounded-[3.1rem] p-[3px]"
        style={{
          background:
            "linear-gradient(150deg, oklch(0.82 0.01 285) 0%, oklch(0.42 0.01 285) 18%, oklch(0.68 0.01 285) 34%, oklch(0.30 0.01 285) 52%, oklch(0.72 0.01 285) 70%, oklch(0.36 0.01 285) 86%, oklch(0.80 0.01 285) 100%)",
          boxShadow:
            "0 2px 4px oklch(0 0 0 / 0.28), 0 12px 24px oklch(0 0 0 / 0.22), 0 40px 70px -10px oklch(0.52 0.28 300 / 0.35), inset 0 0 0 1px oklch(1 0 0 / 0.12)",
        }}
      >
        {/* Кнопки: беззвучный режим + громкость */}
        <div
          className="absolute -left-[3px] top-[104px] h-8 w-[3px] rounded-l-sm"
          style={{ background: "linear-gradient(90deg, oklch(0.32 0.01 285), oklch(0.60 0.01 285))" }}
          aria-hidden="true"
        />
        <div
          className="absolute -left-[3px] top-[156px] h-14 w-[3px] rounded-l-sm"
          style={{ background: "linear-gradient(90deg, oklch(0.32 0.01 285), oklch(0.60 0.01 285))" }}
          aria-hidden="true"
        />
        <div
          className="absolute -left-[3px] top-[224px] h-14 w-[3px] rounded-l-sm"
          style={{ background: "linear-gradient(90deg, oklch(0.32 0.01 285), oklch(0.60 0.01 285))" }}
          aria-hidden="true"
        />
        {/* Кнопка питания */}
        <div
          className="absolute -right-[3px] top-[180px] h-20 w-[3px] rounded-r-sm"
          style={{ background: "linear-gradient(270deg, oklch(0.32 0.01 285), oklch(0.60 0.01 285))" }}
          aria-hidden="true"
        />

        {/* Чёрный бортик корпуса — экран лежит внутри него, а не поверх телефона */}
        <div className="h-full w-full rounded-[2.9rem] bg-black p-[9px] ring-1 ring-inset ring-white/10">

        {/* Внутренняя фаска + экран */}
        <div
          className="relative isolate h-full w-full overflow-hidden rounded-[2.35rem] bg-black"
          style={{
            /* clip-path надёжно обрезает <video> по радиусу:
               overflow:hidden не влияет на композиционный слой видео в WebKit/Chrome */
            clipPath: "inset(0 round 2.35rem)",
          }}
        >
          <video
            ref={videoRef}
            src={src}
            poster={poster}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            className="absolute inset-0 h-full w-full rounded-[2.35rem] object-cover"
          />

          {/* Лёгкое затемнение по краям стекла */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 80% at 50% 0%, transparent 55%, oklch(0 0 0 / 0.35) 100%)",
            }}
            aria-hidden="true"
          />

          {/* Диагональный блик по стеклу */}
          <div
            className="pointer-events-none absolute inset-0 mix-blend-screen opacity-[0.16]"
            style={{
              background:
                "linear-gradient(115deg, transparent 20%, oklch(1 0 0 / 0.9) 38%, transparent 46%, transparent 72%, oklch(1 0 0 / 0.55) 80%, transparent 88%)",
            }}
            aria-hidden="true"
          />

          {/* Dynamic Island */}
          <div className="absolute left-1/2 top-2.5 z-10 flex h-[26px] w-[92px] -translate-x-1/2 items-center justify-end rounded-full bg-black pr-2.5 shadow-[inset_0_0_1px_oklch(1_0_0/0.2)]">
            <span
              className="h-[9px] w-[9px] rounded-full"
              style={{
                background:
                  "radial-gradient(circle at 32% 30%, oklch(0.45 0.09 250) 0%, oklch(0.18 0.04 265) 55%, oklch(0.08 0.01 265) 100%)",
                boxShadow: "inset 0 0 2px oklch(1 0 0 / 0.25)",
              }}
              aria-hidden="true"
            />
          </div>

          {/* Home indicator */}
          <div
            className="absolute bottom-2 left-1/2 z-10 h-[5px] w-[110px] -translate-x-1/2 rounded-full bg-white/70"
            aria-hidden="true"
          />

          {/* Кнопка звука */}
          <button
            type="button"
            onClick={toggleSound}
            aria-label={muted ? "Включить звук видео" : "Выключить звук видео"}
            className="absolute bottom-6 right-4 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md transition-colors hover:bg-black/65 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {muted ? <VolumeX className="h-[18px] w-[18px]" /> : <Volume2 className="h-[18px] w-[18px]" />}
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
