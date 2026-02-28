"use client"

import { useState, useCallback, useRef, memo } from "react"

type ClockMode = "hours" | "minutes"

interface ClockPickerProps {
  value: string // "HH:MM"
  onChange: (value: string) => void
}

const HOUR_OUTER = Array.from({ length: 12 }, (_, i) => i + 1) // 1–12
const MINUTE_MARKS = Array.from({ length: 12 }, (_, i) => i * 5)  // 0,5,10...55

function getAngle(cx: number, cy: number, x: number, y: number): number {
  let angle = Math.atan2(y - cy, x - cx) * (180 / Math.PI) + 90
  if (angle < 0) angle += 360
  return angle
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

export const ClockPicker = memo(function ClockPicker({ value, onChange }: ClockPickerProps) {
  const [mode, setMode] = useState<ClockMode>("hours")
  const svgRef = useRef<SVGSVGElement>(null)
  const dragging = useRef(false)
  const switchOnUp = useRef(false)

  const SIZE = 260
  const CX = SIZE / 2
  const CY = SIZE / 2
  const FACE_R = SIZE / 2 - 6
  const OUTER_R = 96
  const INNER_R = 62
  const TICK_OUTER = FACE_R - 2
  const TICK_INNER_LONG = FACE_R - 12
  const TICK_INNER_SHORT = FACE_R - 7

  const [hStr, mStr] = value.split(":")
  const hours = parseInt(hStr, 10)
  const minutes = parseInt(mStr, 10)

  // hours 1–12 → outer ring, hours 0 + 13–23 → inner ring
  const isInnerHour = hours === 0 || hours >= 13
  const clockPos = isInnerHour ? (hours === 0 ? 12 : hours - 12) : hours // 1–12 position on face
  const hourAngle = (clockPos / 12) * 360
  const minAngle = (minutes / 60) * 360
  const handAngle = mode === "hours" ? hourAngle : minAngle
  const handR = mode === "hours" ? (isInnerHour ? INNER_R - 8 : OUTER_R - 8) : OUTER_R - 8
  const display12 = hours % 12 === 0 ? 12 : hours % 12
  const isAfternoon = hours >= 12
  const handEnd = polar(CX, CY, handR, handAngle)

  function getSVGPoint(clientX: number, clientY: number) {
    const svg = svgRef.current
    if (!svg) return { x: CX, y: CY }
    const rect = svg.getBoundingClientRect()
    return {
      x: (clientX - rect.left) * (SIZE / rect.width),
      y: (clientY - rect.top) * (SIZE / rect.height),
    }
  }

  const interact = useCallback(
    (clientX: number, clientY: number) => {
      const { x, y } = getSVGPoint(clientX, clientY)
      const angle = getAngle(CX, CY, x, y)
      const dx = x - CX
      const dy = y - CY
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (mode === "hours") {
        const raw = Math.round(angle / 30) % 12 || 12
        const mid = (OUTER_R + INNER_R) / 2
        const isInner = dist < mid
        // Outer ring: 1–12 (дневное). Inner ring: 13–23 + 00
        const h = isInner ? (raw === 12 ? 0 : raw + 12) : raw
        onChange(`${String(h).padStart(2, "0")}:${mStr}`)
        switchOnUp.current = true
      } else {
        const raw = Math.round(angle / 6) % 60
        onChange(`${hStr}:${String(raw).padStart(2, "0")}`)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, hStr, mStr, onChange],
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      dragging.current = true
      ;(e.target as Element).setPointerCapture(e.pointerId)
      interact(e.clientX, e.clientY)
    },
    [interact],
  )
  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (dragging.current) interact(e.clientX, e.clientY)
    },
    [interact],
  )
  const onPointerUp = useCallback(() => {
    dragging.current = false
    if (switchOnUp.current) {
      switchOnUp.current = false
      setMode("minutes")
    }
  }, [])

  return (
    <div className="flex flex-col items-center gap-4 select-none">
      {/* Digital display */}
      <div className="flex items-center gap-1 rounded-2xl bg-secondary px-5 py-2.5 font-mono text-4xl font-bold tracking-tight shadow-inner">
        <button
          type="button"
          onClick={() => setMode("hours")}
          className={`rounded-xl px-2 py-1 transition-all duration-150 ${
            mode === "hours"
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {hStr}
        </button>
        <span className="animate-pulse text-muted-foreground">:</span>
        <button
          type="button"
          onClick={() => setMode("minutes")}
          className={`rounded-xl px-2 py-1 transition-all duration-150 ${
            mode === "minutes"
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {mStr}
        </button>
      </div>

      {/* Clock face */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width={SIZE}
        height={SIZE}
        className="touch-none cursor-pointer drop-shadow-sm"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {/* Face background */}
        <circle cx={CX} cy={CY} r={FACE_R} fill="var(--secondary)" />

        {/* Tick marks */}
        {Array.from({ length: 60 }, (_, i) => {
          const angle = (i / 60) * 360
          const isLong = i % 5 === 0
          const o = polar(CX, CY, TICK_OUTER, angle)
          const inn = polar(CX, CY, isLong ? TICK_INNER_LONG : TICK_INNER_SHORT, angle)
          return (
            <line
              key={i}
              x1={o.x} y1={o.y}
              x2={inn.x} y2={inn.y}
              stroke="var(--border)"
              strokeWidth={isLong ? 1.5 : 0.75}
              strokeLinecap="round"
            />
          )
        })}

        {/* Shaded selection sector */}
        {(() => {
          const a = handAngle
          const spread = mode === "hours" ? 15 : 3
          const start = polar(CX, CY, FACE_R - 2, a - spread)
          const end = polar(CX, CY, FACE_R - 2, a + spread)
          const large = spread * 2 > 180 ? 1 : 0
          return (
            <path
              d={`M${CX},${CY} L${start.x},${start.y} A${FACE_R - 2},${FACE_R - 2} 0 ${large} 1 ${end.x},${end.y} Z`}
              fill="var(--primary)"
              opacity="0.12"
            />
          )
        })()}

        {/* Hand line — rendered before numbers so numbers appear on top */}
        <line
          x1={CX} y1={CY}
          x2={handEnd.x} y2={handEnd.y}
          stroke="var(--primary)"
          strokeWidth={2.5}
          strokeLinecap="round"
          style={{ transition: "x2 0.15s, y2 0.15s" }}
        />

        {/* Hand end circle */}
        <circle cx={handEnd.x} cy={handEnd.y} r={6} fill="var(--primary)" />

        {/* Center dot */}
        <circle cx={CX} cy={CY} r={4.5} fill="var(--primary)" />

        {/* Hour numbers — outer ring (1–12, AM / 00–11 outer) */}
        {mode === "hours" &&
          HOUR_OUTER.map((n) => {
            const angle = (n / 12) * 360
            const pos = polar(CX, CY, OUTER_R, angle)
            const selected = hours === n
            return (
              <g key={`ho-${n}`}>
                {selected && <circle cx={pos.x} cy={pos.y} r={16} fill="var(--primary)" />}
                <text
                  x={pos.x} y={pos.y}
                  textAnchor="middle" dominantBaseline="central"
                  fontSize={13} fontWeight={selected ? 700 : 500}
                  fill={selected ? "var(--primary-foreground)" : "var(--foreground)"}
                >
                  {n}
                </text>
              </g>
            )
          })}

        {/* Hour numbers — inner ring (13–23 + 00) */}
        {mode === "hours" &&
          HOUR_OUTER.map((n) => {
            const inner = n === 12 ? 0 : n + 12
            const angle = (n / 12) * 360
            const pos = polar(CX, CY, INNER_R, angle)
            const selected = hours === inner
            return (
              <g key={`hi-${n}`}>
                {selected && <circle cx={pos.x} cy={pos.y} r={13} fill="var(--primary)" />}
                <text
                  x={pos.x} y={pos.y}
                  textAnchor="middle" dominantBaseline="central"
                  fontSize={11} fontWeight={selected ? 700 : 400}
                  fill={selected ? "var(--primary-foreground)" : "var(--muted-foreground)"}
                >
                  {inner === 0 ? "00" : inner}
                </text>
              </g>
            )
          })}

        {/* Minute numbers */}
        {mode === "minutes" &&
          MINUTE_MARKS.map((n) => {
            const angle = (n / 60) * 360
            const pos = polar(CX, CY, OUTER_R, angle)
            const selected = minutes === n
            return (
              <g key={`m-${n}`}>
                {selected && <circle cx={pos.x} cy={pos.y} r={16} fill="var(--primary)" />}
                <text
                  x={pos.x} y={pos.y}
                  textAnchor="middle" dominantBaseline="central"
                  fontSize={12} fontWeight={selected ? 700 : 500}
                  fill={selected ? "var(--primary-foreground)" : "var(--foreground)"}
                >
                  {String(n).padStart(2, "0")}
                </text>
              </g>
            )
          })}


      </svg>

      {/* Mode hint */}
      <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
        {mode === "hours" ? "Часы" : "Минуты"}
      </p>
    </div>
  )
})
