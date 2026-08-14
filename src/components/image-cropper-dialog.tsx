"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Loader2, ZoomIn, ZoomOut } from "lucide-react"

/**
 * Сторона итогового квадрата в пикселях.
 * 800 выбрано с запасом: самое большое место вывода — герой на /doctor/{id}
 * (288px на десктопе), при 2x DPR это 576px, так что 800 не мылит.
 */
const OUTPUT_SIZE = 800
const JPEG_QUALITY = 0.9
/** Во сколько раз можно приблизить относительно «фото целиком заполняет квадрат». */
const MAX_ZOOM_OVER_COVER = 4
const ZOOM_STEP = 1.2

/** Сдвиг фото внутри рамки: не даём уехать за края, меньшее фото центрируем. */
function clampOffset(value: number, displaySize: number, viewport: number) {
  const min = viewport - displaySize
  if (min >= 0) return min / 2
  return Math.min(0, Math.max(min, value))
}

interface ImageCropperDialogProps {
  /** Файл, выбранный пользователем. `null` — диалог закрыт. */
  file: File | null
  onCancel: () => void
  /** Отдаёт готовый квадратный JPEG. */
  onApply: (cropped: File) => void
}

export function ImageCropperDialog({ file, onCancel, onApply }: ImageCropperDialogProps) {
  const observerRef = useRef<ResizeObserver | null>(null)
  const initializedForRef = useRef<HTMLImageElement | null>(null)
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; startOffX: number; startOffY: number } | null>(null)

  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  /** Декодированное изображение: держим сам элемент, чтобы рисовать им на canvas. */
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [viewport, setViewport] = useState(0)
  /**
   * zoom — множитель к масштабу «фото целиком видно в квадрате» (fit):
   * 1 — видно всё фото с белыми полями, coverZoom — квадрат заполнен.
   * x/y — сдвиг фото внутри рамки.
   *
   * Держим одним объектом, потому что зум пересчитывает сдвиг: Radix за один
   * жест шлёт несколько onValueChange, и при раздельных состояниях второй
   * вызов считал бы новый сдвиг от уже сдвинутого значения по старому масштабу.
   */
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 })
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Декодируем файл сами, а не полагаемся на onLoad отрисованного <img>:
  // так размеры точно известны до первого расчёта кропа.
  useEffect(() => {
    if (!file) {
      setObjectUrl(null)
      setImage(null)
      return
    }
    const url = URL.createObjectURL(file)
    setObjectUrl(url)
    setImage(null)
    setError(null)

    const img = new Image()
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) {
        setError("Не удалось прочитать изображение. Попробуйте другой файл.")
        return
      }
      setImage(img)
    }
    img.onerror = () => {
      setError("Не удалось загрузить изображение. Попробуйте другой файл.")
    }
    img.src = url

    return () => {
      img.onload = null
      img.onerror = null
      URL.revokeObjectURL(url)
    }
  }, [file])

  // Рамка резиновая, поэтому её сторону надо измерять — от неё зависит вся
  // математика кропа. Callback-ref, т.к. Dialog монтирует контент только открытым.
  const attachViewport = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect()
    observerRef.current = null
    if (!node) return
    const measure = () => setViewport(node.getBoundingClientRect().width)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    observerRef.current = observer
  }, [])

  useEffect(() => () => observerRef.current?.disconnect(), [])

  const naturalW = image?.naturalWidth ?? 0
  const naturalH = image?.naturalHeight ?? 0
  const isReady = Boolean(image) && viewport > 0

  /** Масштаб, при котором фото целиком влезает в квадрат. */
  const fitScale = isReady ? Math.min(viewport / naturalW, viewport / naturalH) : 0
  /** Во сколько раз нужно увеличить fit, чтобы фото закрыло квадрат целиком. */
  const coverZoom = isReady ? Math.max(naturalW, naturalH) / Math.min(naturalW, naturalH) : 1
  const maxZoom = coverZoom * MAX_ZOOM_OVER_COVER
  const scale = fitScale * view.zoom
  const displayW = naturalW * scale
  const displayH = naturalH * scale

  // Стартовый кадр: заполненный квадрат по центру — самый предсказуемый результат.
  useEffect(() => {
    if (!image || !viewport) return
    if (initializedForRef.current === image) return
    initializedForRef.current = image
    const startScale = Math.max(viewport / image.naturalWidth, viewport / image.naturalHeight)
    setView({
      zoom: coverZoom,
      x: (viewport - image.naturalWidth * startScale) / 2,
      y: (viewport - image.naturalHeight * startScale) / 2,
    })
  }, [image, viewport, coverZoom])

  // При изменении рамки фото не должно «отлипать» от краёв.
  useEffect(() => {
    if (!isReady) return
    setView((prev) => ({
      ...prev,
      x: clampOffset(prev.x, displayW, viewport),
      y: clampOffset(prev.y, displayH, viewport),
    }))
  }, [isReady, displayW, displayH, viewport])

  const applyZoom = useCallback(
    (next: number) => {
      if (!isReady) return
      const center = viewport / 2
      setView((prev) => {
        const target = Math.min(maxZoom, Math.max(1, next))
        const prevScale = fitScale * prev.zoom
        const nextScale = fitScale * target
        if (!prevScale) return prev
        // Держим центр рамки на той же точке фото, иначе зум «уезжает» в угол.
        return {
          zoom: target,
          x: clampOffset(center - ((center - prev.x) * nextScale) / prevScale, naturalW * nextScale, viewport),
          y: clampOffset(center - ((center - prev.y) * nextScale) / prevScale, naturalH * nextScale, viewport),
        }
      })
    },
    [isReady, maxZoom, viewport, fitScale, naturalW, naturalH],
  )

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!isReady) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startOffX: view.x,
      startOffY: view.y,
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    setView((prev) => ({
      ...prev,
      x: clampOffset(drag.startOffX + (e.clientX - drag.startX), displayW, viewport),
      y: clampOffset(drag.startOffY + (e.clientY - drag.startY), displayH, viewport),
    }))
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null
  }

  function handleWheel(e: React.WheelEvent<HTMLDivElement>) {
    if (!isReady) return
    e.preventDefault()
    applyZoom(view.zoom * (e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP))
  }

  async function handleApply() {
    if (!image || !isReady || !file) return

    setIsProcessing(true)
    setError(null)
    try {
      // Переводим рамку в координаты исходного файла.
      const sourceSide = viewport / scale
      const sourceX = -view.x / scale
      const sourceY = -view.y / scale

      const canvas = document.createElement("canvas")
      canvas.width = OUTPUT_SIZE
      canvas.height = OUTPUT_SIZE
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Canvas недоступен")

      // JPEG не имеет альфа-канала: заливка нужна и под прозрачный PNG,
      // и под белые поля при уменьшении фото меньше рамки.
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
      ctx.imageSmoothingQuality = "high"

      // Источник может выходить за пределы фото — обрезаем его и синхронно
      // сжимаем приёмник, иначе картинка растянется на белых полях.
      const clippedX = Math.max(0, sourceX)
      const clippedY = Math.max(0, sourceY)
      const clippedW = Math.min(naturalW, sourceX + sourceSide) - clippedX
      const clippedH = Math.min(naturalH, sourceY + sourceSide) - clippedY
      if (clippedW > 0 && clippedH > 0) {
        const pxPerSource = OUTPUT_SIZE / sourceSide
        ctx.drawImage(
          image,
          clippedX,
          clippedY,
          clippedW,
          clippedH,
          (clippedX - sourceX) * pxPerSource,
          (clippedY - sourceY) * pxPerSource,
          clippedW * pxPerSource,
          clippedH * pxPerSource,
        )
      }

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
            Перетащите фото и настройте масштаб — колесом мыши или ползунком. Эта квадратная область будет показываться во всём приложении.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div
            ref={attachViewport}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
            className="relative w-full aspect-square overflow-hidden rounded-xl bg-muted touch-none select-none cursor-grab active:cursor-grabbing"
          >
            {objectUrl && (
              <img
                src={objectUrl}
                alt=""
                draggable={false}
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: displayW ? `${displayW}px` : "auto",
                  height: displayH ? `${displayH}px` : "auto",
                  transform: `translate(${view.x}px, ${view.y}px)`,
                  visibility: isReady ? "visible" : "hidden",
                }}
              />
            )}
            {/* Сетка третей: кадр квадратный, помогает выровнять лицо по центру */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-inset ring-primary/60"
            >
              <div className="absolute left-1/3 top-0 h-full w-px bg-foreground/15" />
              <div className="absolute left-2/3 top-0 h-full w-px bg-foreground/15" />
              <div className="absolute top-1/3 left-0 w-full h-px bg-foreground/15" />
              <div className="absolute top-2/3 left-0 w-full h-px bg-foreground/15" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8 shrink-0"
              onClick={() => applyZoom(view.zoom / ZOOM_STEP)}
              disabled={!isReady || view.zoom <= 1}
              aria-label="Уменьшить"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Slider
              value={[Math.min(maxZoom, Math.max(1, view.zoom))]}
              min={1}
              max={maxZoom}
              step={0.01}
              onValueChange={([value]) => applyZoom(value)}
              disabled={!isReady}
              aria-label="Масштаб фото"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8 shrink-0"
              onClick={() => applyZoom(view.zoom * ZOOM_STEP)}
              disabled={!isReady || view.zoom >= maxZoom}
              aria-label="Увеличить"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Уменьшите масштаб, чтобы в квадрат попало всё фото — пустые края станут белыми.
          </p>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={isProcessing}>
            Отмена
          </Button>
          <Button type="button" onClick={handleApply} disabled={!isReady || isProcessing}>
            {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
            Применить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
