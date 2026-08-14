"use client"

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Loader2, ZoomIn, ZoomOut } from "lucide-react"

/**
 * Сторона итогового квадрата в пикселях.
 * 800 выбрано с запасом: самое большое место вывода — герой на /doctor/{id}
 * (320px на десктопе), при 2x DPR это 640px, так что 800 не мылит.
 */
const OUTPUT_SIZE = 800
const JPEG_QUALITY = 0.9
const MIN_ZOOM = 1
const MAX_ZOOM = 3

interface ImageCropperDialogProps {
  /** Файл, выбранный пользователем. `null` — диалог закрыт. */
  file: File | null
  onCancel: () => void
  /** Отдаёт готовый квадратный JPEG. */
  onApply: (cropped: File) => void
}

export function ImageCropperDialog({ file, onCancel, onApply }: ImageCropperDialogProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; startOffX: number; startOffY: number } | null>(null)

  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [viewport, setViewport] = useState(0)
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Создаём/освобождаем blob-URL строго по времени жизни файла, иначе
  // предыдущий URL утечёт при повторном выборе фото.
  useEffect(() => {
    if (!file) {
      setObjectUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setObjectUrl(url)
    setNatural(null)
    setZoom(MIN_ZOOM)
    setOffset({ x: 0, y: 0 })
    setError(null)
    return () => URL.revokeObjectURL(url)
  }, [file])

  // Рамка квадратная и резиновая, поэтому её реальную сторону надо измерить,
  // а не хардкодить — от неё зависит вся математика кропа.
  useLayoutEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const measure = () => setViewport(el.getBoundingClientRect().width)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [objectUrl])

  /** Масштаб, при котором фото полностью закрывает квадрат (cover). */
  const baseScale = natural && viewport ? Math.max(viewport / natural.w, viewport / natural.h) : 0
  const scale = baseScale * zoom
  const displayW = natural ? natural.w * scale : 0
  const displayH = natural ? natural.h * scale : 0

  const clamp = useCallback(
    (value: number, displaySize: number) => {
      const min = viewport - displaySize
      if (min >= 0) return min / 2
      return Math.min(0, Math.max(min, value))
    },
    [viewport],
  )

  // При смене zoom/размера рамки фото не должно «отлипать» от краёв.
  useEffect(() => {
    if (!natural || !viewport) return
    setOffset((prev) => ({ x: clamp(prev.x, displayW), y: clamp(prev.y, displayH) }))
  }, [natural, viewport, displayW, displayH, clamp])

  function handleImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget
    imageRef.current = img
    const w = img.naturalWidth
    const h = img.naturalHeight
    if (!w || !h) {
      setError("Не удалось прочитать изображение. Попробуйте другой файл.")
      return
    }
    setNatural({ w, h })
    // Стартуем по центру — самый предсказуемый кроп для портрета.
    const s = Math.max(viewport / w, viewport / h)
    setOffset({ x: (viewport - w * s) / 2, y: (viewport - h * s) / 2 })
  }

  function handleZoomChange(next: number) {
    if (!natural || !viewport) return
    const center = viewport / 2
    const prevScale = baseScale * zoom
    const nextScale = baseScale * next
    // Держим центр рамки на той же точке фото, иначе зум «уезжает» в угол.
    setOffset((prev) => ({
      x: clamp(center - ((center - prev.x) * nextScale) / prevScale, natural.w * nextScale),
      y: clamp(center - ((center - prev.y) * nextScale) / prevScale, natural.h * nextScale),
    }))
    setZoom(next)
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!natural) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startOffX: offset.x,
      startOffY: offset.y,
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    setOffset({
      x: clamp(drag.startOffX + (e.clientX - drag.startX), displayW),
      y: clamp(drag.startOffY + (e.clientY - drag.startY), displayH),
    })
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null
  }

  async function handleApply() {
    const img = imageRef.current
    if (!img || !natural || !viewport || !file) return

    setIsProcessing(true)
    setError(null)
    try {
      // Переводим смещение рамки в координаты исходного файла.
      const sourceSide = viewport / scale
      const sourceX = -offset.x / scale
      const sourceY = -offset.y / scale

      const canvas = document.createElement("canvas")
      canvas.width = OUTPUT_SIZE
      canvas.height = OUTPUT_SIZE
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Canvas недоступен")

      // JPEG не имеет альфа-канала: без заливки прозрачный PNG станет чёрным.
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
      ctx.imageSmoothingQuality = "high"
      ctx.drawImage(img, sourceX, sourceY, sourceSide, sourceSide, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
      )
      if (!blob) throw new Error("Не удалось обработать изображение")

      const baseName = file.name.replace(/\.[^.]+$/, "") || "photo"
      onApply(new File([blob], `${baseName}-square.jpg`, { type: "image/jpeg" }))
    } catch (err) {
      console.error("[cropper] apply failed:", err)
      setError(err instanceof Error ? err.message : "Не удалось обработать изображение")
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Dialog open={Boolean(file)} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Выберите область фото</DialogTitle>
          <DialogDescription>
            Перетащите фото и настройте масштаб. Эта квадратная область будет показываться во всём приложении.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div
            ref={viewportRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="relative w-full aspect-square overflow-hidden rounded-xl bg-muted touch-none select-none cursor-grab active:cursor-grabbing"
          >
            {objectUrl && (
              <img
                src={objectUrl}
                alt=""
                draggable={false}
                onLoad={handleImageLoad}
                onError={() => setError("Не удалось загрузить изображение")}
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: displayW ? `${displayW}px` : "auto",
                  height: displayH ? `${displayH}px` : "auto",
                  transform: `translate(${offset.x}px, ${offset.y}px)`,
                  visibility: natural ? "visible" : "hidden",
                }}
              />
            )}
            {/* Подсказка круглого кадра: половина мест вывода — круглые аватарки */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-full border-2 border-primary/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
            />
          </div>

          <div className="flex items-center gap-3">
            <ZoomOut className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
            <Slider
              value={[zoom]}
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              onValueChange={([value]) => handleZoomChange(value)}
              disabled={!natural}
              aria-label="Масштаб фото"
            />
            <ZoomIn className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={isProcessing}>
            Отмена
          </Button>
          <Button type="button" onClick={handleApply} disabled={!natural || isProcessing}>
            {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
            Применить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
