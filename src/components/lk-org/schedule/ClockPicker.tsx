"use client"

import { useState, useCallback, useRef, memo } from "react"

type ClockMode = "hours" | "minutes"

interface ClockPickerProps {
  value: string // "HH:MM"
  onChange: (value: string) => void
}

const HOUR_NUMBERS = Array.from({ length: 12 }, (_, i) => i + 1)
const MINUTE_NUMBERS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

function getAngle(cx: number, cy: number, x: number, y: number): number {
  const dx = x - cx
  const dy = y - cy
  let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90
  if (angle < 0) angle += 360
  return angle
}

function polarToXY(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number,
): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

export const ClockPicker = memo(function ClockPicker({
  value,
  onChange,
}: ClockPickerProps) {
  const [mode, setMode] = useState<ClockMode>("hours")
  const svgRef = useRef<SVGSVGElement>(null)
  const isDragging = useRef(false)

  const [hStr, mStr] = value.split(":")
  const hours = parseInt(hStr, 10)
  const minutes = parseInt(mStr, 10)

  const SIZE = 240
  const CX = SIZE / 2
  const CY = SIZE / 2
  const OUTER_R = 90
  const INNER_R = 60 // for 0/00-11 inner ring (24h)
  const HAND_R = OUTER_R - 10

  // 24h: 1–12 on outer ring, 13–24(0) on inner ring
  const displayHour12 = hours % 12 === 0 ? 12 : hours % 12
  const isInnerRing = hours >= 12 && hours !== 0

  const hourAngle = (displayHour12 / 12) * 360
  const minAngle = (minutes / 60) * 360

  const handAngle = mode === "hours" ? hourAngle : minAngle
  const handR = mode === "hours" ? (isInnerRing ? INNER_R - 10 : HAND_R) : HAND_R
  const handEnd = polarToXY(CX, CY, handR, handAngle)

  function getSVGPoint(clientX: number, clientY: number) {
    const svg = svgRef.current
    if (!svg) return { x: CX, y: CY }
    const rect = svg.getBoundingClientRect()
    const scaleX = SIZE / rect.width
    const scaleY = SIZE / rect.height
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    }
  }

  const handleClockInteraction = useCallback(
    (clientX: number, clientY: number) => {
      const { x, y } = getSVGPoint(clientX, clientY)
      const angle = getAngle(CX, CY, x, y)
      const dx = x - CX
      const dy = y - CY
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (mode === "hours") {
        const raw = Math.round(angle / 30) % 12 || 12
        // inner ring if dist < midpoint
        const mid = (OUTER_R + INNER_R) / 2
        if (dist < mid) {
          // inner = 0,13..23
          const inner = raw === 12 ? 0 : raw + 12
          const hh = String(inner).padStart(2, "0")
          onChange(`${hh}:${mStr}`)
        } else {
          const hh = String(raw).padStart(2, "0")
          onChange(`${hh}:${mStr}`)
        }
        // auto-switch to minutes after picking hour
        setTimeout(() => setMode("minutes"), 180)
      } else {
        const raw = Math.round(angle / 6) % 60
        const mm = String(raw).padStart(2, "0")
        onChange(`${hStr}:${mm}`)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, hStr, mStr, onChange],
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      isDragging.current = true
      ;(e.target as Element).setPointerCapture(e.pointerId)
      handleClockInteraction(e.clientX, e.clientY)
    },
    [handleClockInteraction],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!isDragging.current) return
      handleClockInteraction(e.clientX, e.clientY)
    },
    [handleClockInteraction],
  )

  const onPointerUp = useCallback(() => {
    isDragging.current = false
  }, [])

  return (
    <div className="flex flex-col items-center gap-3 select-none">
      {/* Digital display */}
      <div className="flex items-center gap-0.5 rounded-xl bg-secondary px-4 py-2 text-3xl font-mono font-semibold tracking-tight">
        <button
          type="button"
          onClick={() => setMode("hours")}
          className={`rounded-md px-1.5 py-0.5 transition-colors ${
            mode === "hours"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {hStr}
        </button>
        <span className="text-muted-foreground">:</span>
        <button
          type="button"
          onClick={() => setMode("minutes")}
          className={`rounded-md px-1.5 py-0.5 transition-colors ${
            mode === "minutes"
              ? "bg-primary text-primary-foreground"
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
        className="touch-none cursor-pointer"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {/* Background */}
        <circle cx={CX} cy={CY} r={SIZE / 2 - 4} fill="var(--secondary)" />

        {/* Hour numbers — outer ring (1–12) */}
        {mode === "hours" &&
          HOUR_NUMBERS.map((n) => {
            const angle = (n / 12) * 360
            const pos = polarToXY(CX, CY, OUTER_R, angle)
            const isSelected = displayHour12 === n && !isInnerRing
            return (
              <g key={`h-${n}`}>
                {isSelected && (
                  <circle cx={pos.x} cy={pos.y} r={15} fill="var(--primary)" />
                )}
                <text
                  x={pos.x}
                  y={pos.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={13}
                  fontWeight={isSelected ? 700 : 400}
                  fill={
                    isSelected ? "var(--primary-foreground)" : "var(--foreground)"
                  }
                >
                  {n}
                </text>
              </g>
            )
          })}

        {/* Hour numbers — inner ring (13–24 / 0) */}
        {mode === "hours" &&
          HOUR_NUMBERS.map((n) => {
            const inner = n === 12 ? 0 : n + 12
            const angle = (n / 12) * 360
            const pos = polarToXY(CX, CY, INNER_R, angle)
            const isSelected =
              (inner === 0 ? hours === 0 : hours === inner) && isInnerRing
            return (
              <g key={`ih-${n}`}>
                {isSelected && (
                  <circle cx={pos.x} cy={pos.y} r={13} fill="var(--primary)" />
                )}
                <text
                  x={pos.x}
                  y={pos.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={11}
                  fontWeight={isSelected ? 700 : 400}
                  fill={
                    isSelected
                      ? "var(--primary-foreground)"
                      : "var(--muted-foreground)"
                  }
                >
                  {inner === 0 ? "00" : inner}
                </text>
              </g>
            )
          })}

        {/* Minute numbers */}
        {mode === "minutes" &&
          MINUTE_NUMBERS.map((n) => {
            const angle = (n / 60) * 360
            const pos = polarToXY(CX, CY, OUTER_R, angle)
            const isSelected = minutes === n
            return (
              <g key={`m-${n}`}>
                {isSelected && (
                  <circle cx={pos.x} cy={pos.y} r={15} fill="var(--primary)" />
                )}
                <text
                  x={pos.x}
                  y={pos.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={12}
                  fontWeight={isSelected ? 700 : 400}
                  fill={
                    isSelected ? "var(--primary-foreground)" : "var(--foreground)"
                  }
                >
                  {String(n).padStart(2, "0")}
                </text>
              </g>
            )
          })}

        {/* Center dot */}
        <circle cx={CX} cy={CY} r={4} fill="var(--primary)" />

        {/* Hand */}
        <line
          x1={CX}
          y1={CY}
          x2={handEnd.x}
          y2={handEnd.y}
          stroke="var(--primary)"
          strokeWidth={2}
          strokeLinecap="round"
        />
        {/* Hand end dot */}
        <circle cx={handEnd.x} cy={handEnd.y} r={5} fill="var(--primary)" />
      </svg>

      {/* Mode label */}
      <p className="text-xs text-muted-foreground">
        {mode === "hours" ? "Выберите часы" : "Выберите минуты"}
      </p>
    </div>
  )
})
