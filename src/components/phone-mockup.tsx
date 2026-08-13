"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  PhoneOff,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  Phone,
} from "lucide-react";

interface PhoneMockupProps {
  src: string;
  poster?: string;
  className?: string;
  /** Имя врача, показываемое в интерфейсе звонка */
  doctorName?: string;
  /** Специализация врача */
  doctorSpeciality?: string;
}

/** Форматирует секунды в мм:сс */
function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Качественный мокап смартфона с видео внутри.
 * Собран на CSS-слоях: титановый корпус, фаска, тень, стекло,
 * Dynamic Island, боковые кнопки, блик и home-indicator.
 * Сверху — интерфейс реальной видеоконсультации: микрофон, камера, завершение звонка.
 */
export function PhoneMockup({
  src,
  poster,
  className,
  doctorName = "Анна Петрова",
  doctorSpeciality = "Кардиолог",
}: PhoneMockupProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [callEnded, setCallEnded] = useState(false);
  const [duration, setDuration] = useState(0);

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

  // Счётчик длительности звонка
  useEffect(() => {
    if (callEnded) return;
    const interval = window.setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [callEnded]);

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

  const endCall = useCallback(() => {
    const video = videoRef.current;
    video?.pause();
    setCallEnded(true);
  }, []);

  const restartCall = useCallback(() => {
    const video = videoRef.current;
    setCallEnded(false);
    setDuration(0);
    setMicOn(true);
    setCameraOn(true);
    if (video) {
      video.currentTime = 0;
      void video.play().catch(() => undefined);
    }
  }, []);

  const controlBase =
    "inline-flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-md transition-all duration-200 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

  return (
    <div className={className}>
      {/* Внешний корпус (титановая рамка) */}
      <div
        className="relative mx-auto w-[240px] sm:w-[270px] lg:w-[290px] aspect-[1/2.03] rounded-[3.1rem] p-[3px]"
        style={{
          background:
            "linear-gradient(150deg, oklch(0.82 0.01 285) 0%, oklch(0.42 0.01 285) 18%, oklch(0.68 0.01 285) 34%, oklch(0.30 0.01 285) 52%, oklch(0.72 0.01 285) 70%, oklch(0.36 0.01 285) 86%, oklch(0.80 0.01 285) 100%)",
          boxShadow:
            "0 2px 4px oklch(0 0 0 / 0.28), 0 12px 24px oklch(0 0 0 / 0.22), 0 40px 70px -10px oklch(0.605 0.104 187 / 0.38), inset 0 0 0 1px oklch(1 0 0 / 0.12)",
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
          <div className="absolute left-1/2 top-2.5 z-30 flex h-[26px] w-[92px] -translate-x-1/2 items-center justify-end rounded-full bg-black pr-2.5 shadow-[inset_0_0_1px_oklch(1_0_0/0.2)]">
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

          {/* Экран «камера выключена» */}
          {!cameraOn && !callEnded && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/85 backdrop-blur-sm">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-lg font-semibold text-white">
                АП
              </span>
              <p className="text-[13px] font-medium text-white/80">Камера выключена</p>
            </div>
          )}

          {/* Шапка звонка: врач + таймер */}
          {!callEnded && (
            <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 bg-gradient-to-b from-black/60 to-transparent px-3 pb-8 pt-[46px]">
              <div className="flex flex-col gap-1">
                <span className="text-[12px] font-semibold leading-none text-white">
                  {doctorName}
                </span>
                <span className="text-[10px] leading-none text-white/70">
                  {doctorSpeciality}
                </span>
                <span className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-black/40 px-2 py-[3px] backdrop-blur-md">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal" aria-hidden="true" />
                  <span className="font-mono text-[10px] leading-none text-white/90 tabular-nums">
                    {formatDuration(duration)}
                  </span>
                </span>
              </div>

              <button
                type="button"
                onClick={toggleSound}
                aria-label={muted ? "Включить звук видео" : "Выключить звук видео"}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md transition-colors hover:bg-black/65 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            </div>
          )}

          {/* Панель управления звонком */}
          {!callEnded && (
            <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 pb-7 pt-10">
              {!micOn && (
                <span className="rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-medium text-white/85 backdrop-blur-md">
                  Микрофон выключен
                </span>
              )}
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setMicOn((prev) => !prev)}
                  aria-label={micOn ? "Выключить микрофон" : "Включить микрофон"}
                  aria-pressed={!micOn}
                  className={`${controlBase} ${
                    micOn
                      ? "bg-white/15 text-white hover:bg-white/25"
                      : "bg-white text-black hover:bg-white/90"
                  }`}
                >
                  {micOn ? <Mic className="h-[18px] w-[18px]" /> : <MicOff className="h-[18px] w-[18px]" />}
                </button>

                <button
                  type="button"
                  onClick={endCall}
                  aria-label="Завершить звонок"
                  className={`${controlBase} bg-destructive text-white shadow-lg shadow-destructive/40 hover:brightness-110`}
                >
                  <PhoneOff className="h-[18px] w-[18px]" />
                </button>

                <button
                  type="button"
                  onClick={() => setCameraOn((prev) => !prev)}
                  aria-label={cameraOn ? "Выключить камеру" : "Включить камеру"}
                  aria-pressed={!cameraOn}
                  className={`${controlBase} ${
                    cameraOn
                      ? "bg-white/15 text-white hover:bg-white/25"
                      : "bg-white text-black hover:bg-white/90"
                  }`}
                >
                  {cameraOn ? <Video className="h-[18px] w-[18px]" /> : <VideoOff className="h-[18px] w-[18px]" />}
                </button>
              </div>
            </div>
          )}

          {/* Экран завершённого звонка */}
          {callEnded && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/88 px-6 text-center backdrop-blur-md">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/15 text-destructive">
                <PhoneOff className="h-6 w-6" />
              </span>
              <div className="flex flex-col gap-1">
                <p className="text-[14px] font-semibold text-white">Звонок завершён</p>
                <p className="font-mono text-[11px] text-white/60 tabular-nums">
                  Длительность {formatDuration(duration)}
                </p>
              </div>
              <button
                type="button"
                onClick={restartCall}
                className="inline-flex items-center gap-2 rounded-full bg-teal px-4 py-2 text-[12px] font-semibold text-teal-foreground transition-colors hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <Phone className="h-3.5 w-3.5" />
                Позвонить снова
              </button>
            </div>
          )}

          {/* Home indicator */}
          <div
            className="absolute bottom-2 left-1/2 z-30 h-[5px] w-[110px] -translate-x-1/2 rounded-full bg-white/70"
            aria-hidden="true"
          />
        </div>
        </div>
      </div>
    </div>
  );
}
