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
/**
 * Во сколько раз рамку выбора можно сделать меньше максимальной.
 * 4 — это ~25% от короткой стороны фото, дальше начинается сильный апскейл.
 */
const MAX_ZOOM = 4
const ZOOM_STEP = 1.2

/** Рамка выбора не должна выходить за пределы фото. */
function clampCrop(value: number, cropSide: number, imageSide: number) {
  return Math.min(Math.max(0, value), Math.max(0, imageSide - cropSide))
}

/**
 * Выбранная область В ПИКСЕЛЯХ ИСХОДНОГО ФАЙЛА.
 * Именно так она хранится в БД: числа самодостаточны и не поедут,
 * если однажды поменять MAX_ZOOM или размер превью.
 */
export interface CropRect {
  x: number
  y: number
  side: number
}

/**
 * Что кропаем: только что выбранный файл или уже сохранённый на сервере исходник.
 */
export type CropSource =
  | { kind: "file"; file: File }
  | { kind: "url"; url: string; name?: string }

interface ImageCropperDialogProps {
  /** `null` — диалог закрыт. Объект должен быть стабильным между рендерами. */
  source: CropSource | null
  /** Ранее сохранённая область — рамка откроется там же, где её оставили. */
  initialCrop?: CropRect | null
  onCancel: () => void
  /** Отдаёт готовый квадратный JPEG и выбранную область. */
  onApply: (result: { file: File; crop: CropRect }) => void
}

export function ImageCropperDialog({ source, initialCrop, onCancel, onApply }: ImageCropperDialogProps) {
  const observerRef = useRef<ResizeObserver | null>(null)
  const initializedForRef = useRef<HTMLImageElement | null>(null)
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; startCropX: number; startCropY: number } | null>(null)

  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  /** Декодированное изображение: держим сам элемент, чтобы рисовать им на canvas. */
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [stage, setStage] = useState(0)
  /**
   * Фото стоит на месте и целиком видно, двигается и меняет размер только рамка выбора.
   *
   * zoom — во сколько раз рамка меньше максимально возможной (короткой стороны фото):
   * 1 — рамка максимальная, MAX_ZOOM — самая маленькая.
   * x/y — левый верхний угол рамки В КООРДИНАТАХ ИСХОДНОГО ФАЙЛА, поэтому
   * ресайз диалога не сбивает выбранную область.
   *
   * Держим одним объектом, т.к. зум пересчитывает и позицию: Radix за один жест
   * шлёт несколько onValueChange, при раздельных состояниях второй вызов считал
   * бы новую позицию от уже сдвинутой по старому размеру рамки.
   */
  const [crop, setCrop] = useState({ zoom: 1, x: 0, y: 0 })
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Декодируем источник сами, а не полагаемся на onLoad отрисованного <img>:
  // так размеры точно известны до первого расчёта кропа.
  useEffect(() => {
    if (!source) {
      setPreviewSrc(null)
      setImage(null)
      return
    }

    const isFile = source.kind === "file"
    const url = isFile ? URL.createObjectURL(source.file) : source.url
    setPreviewSrc(url)
    setImage(null)
    setError(null)

    const img = new Image()
    // Исходник с сервера попадёт на canvas, а tainted canvas ломает toBlob().
    if (!isFile) img.crossOrigin = "anonymous"
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) {
        setError("Не удалось прочитать изображение. Попробуйте другой файл.")
        return
      }
      setImage(img)
    }
    img.onerror = () => {
      setError(
        isFile
          ? "Не удалось загрузить изображение. Попробуйте другой файл."
          : "Не удалось загрузить исходное фото. Загрузите фото заново.",
      )
    }
    img.src = url

    return () => {
      img.onload = null
      img.onerror = null
      if (isFile) URL.revokeObjectURL(url)
    }
  }, [source])

  // Область просмотра резиновая, поэтому её сторону надо измерять — от неё
  // зависит масштаб превью. Callback-ref, т.к. Dialog монтирует контент только открытым.
  const attachStage = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect()
    observerRef.current = null
    if (!node) return
    const measure = () => setStage(node.getBoundingClientRect().width)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    observerRef.current = observer
  }, [])

  useEffect(() => () => observerRef.current?.disconnect(), [])

  const naturalW = image?.naturalWidth ?? 0
  const naturalH = image?.naturalHeight ?? 0
  const isReady = Boolean(image) && stage > 0

  /** Фото всегда показываем целиком: масштаб «влезть в область просмотра». */
  const fitScale = isReady ? Math.min(stage / naturalW, stage / naturalH) : 0
  const displayW = naturalW * fitScale
  const displayH = naturalH * fitScale
  /** Отступы фото внутри квадратной области просмотра (по центру). */
  const photoLeft = (stage - displayW) / 2
  const photoTop = (stage - displayH) / 2

  /** Максимальная рамка — квадрат по короткой стороне фото. */
  const maxCropSide = Math.min(naturalW, naturalH)
  const cropSide = maxCropSide / crop.zoom

  // Стартовый кадр: сохранённая область, иначе максимальная рамка по центру фото.
  useEffect(() => {
    if (!image) return
    if (initializedForRef.current === image) return
    initializedForRef.current = image

    const maxSide = Math.min(image.naturalWidth, image.naturalHeight)

    if (initialCrop && initialCrop.side > 0) {
      // Сохранённая область могла быть посчитана для другого MAX_ZOOM — зажимаем.
      const side = Math.min(Math.max(initialCrop.side, maxSide / MAX_ZOOM), maxSide)
      setCrop({
        zoom: maxSide / side,
        x: clampCrop(initialCrop.x, side, image.naturalWidth),
        y: clampCrop(initialCrop.y, side, image.naturalHeight),
      })
      return
    }

    setCrop({
      zoom: 1,
      x: (image.naturalWidth - maxSide) / 2,
      y: (image.naturalHeight - maxSide) / 2,
    })
  }, [image, initialCrop])

  const applyZoom = useCallback(
    (next: number) => {
      if (!isReady) return
      setCrop((prev) => {
        const zoom = Math.min(MAX_ZOOM, Math.max(1, next))
        const prevSide = maxCropSide / prev.zoom
        const side = maxCropSide / zoom
        // Центр рамки остаётся на месте, иначе выбор «уезжает» в угол.
        const centerX = prev.x + prevSide / 2
        const centerY = prev.y + prevSide / 2
        return {
          zoom,
          x: clampCrop(centerX - side / 2, side, naturalW),
          y: clampCrop(centerY - side / 2, side, naturalH),
        }
      })
    },
    [isReady, maxCropSide, naturalW, naturalH],
  )

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!isReady) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startCropX: crop.x,
      startCropY: crop.y,
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId || !fitScale) return
    // Курсор двигается в пикселях превью, рамка живёт в пикселях файла.
    const dx = (e.clientX - drag.startX) / fitScale
    const dy = (e.clientY - drag.startY) / fitScale
    setCrop((prev) => {
      const side = maxCropSide / prev.zoom
      return {
        ...prev,
        x: clampCrop(drag.startCropX + dx, side, naturalW),
        y: clampCrop(drag.startCropY + dy, side, naturalH),
      }
    })
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null
  }

  function handleWheel(e: React.WheelEvent<HTMLDivElement>) {
    if (!isReady) return
    e.preventDefault()
    // Колесо «от себя» — приближаем, то есть рамка становится меньше.
    applyZoom(crop.zoom * (e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP))
  }

  async function handleApply() {
    if (!image || !isReady || !source) return

    setIsProcessing(true)
    setError(null)
    try {
      const canvas = document.createElement("canvas")
      canvas.width = OUTPUT_SIZE
      canvas.height = OUTPUT_SIZE
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Canvas недоступен")

      // JPEG не имеет альфа-канала, поэтому под прозрачный PNG нужна заливка.
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
      ctx.imageSmoothingQuality = "high"

      // Рамка всегда внутри фото, так что источник обрезать не нужно.
      ctx.drawImage(image, crop.x, crop.y, cropSide, cropSide, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
      )
      if (!blob) throw new Error("Не удалось обработать изображение")

      const sourceName = source.kind === "file" ? source.file.name : (source.name ?? "photo")
      const baseName = sourceName.replace(/\.[^.]+$/, "") || "photo"
      onApply({
        file: new File([blob], `${baseName}-square.jpg`, { type: "image/jpeg" }),
        crop: {
          x: Math.round(crop.x),
          y: Math.round(crop.y),
          side: Math.round(cropSide),
        },
      })
    } catch (err) {
      console.error("[cropper] apply failed:", err)
      setError(err instanceof Error ? err.message : "Не удалось обработать изображение")
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Dialog open={Boolean(source)} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Выберите область фото</DialogTitle>
          <DialogDescription>
            Перетащите рамку и настройте её размер — колесом мыши или ползунком. Эта квадратная область будет показываться во всём приложении.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div
            ref={attachStage}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
            className="relative w-full aspect-square overflow-hidden rounded-xl bg-muted touch-none select-none cursor-grab active:cursor-grabbing"
          >
            {previewSrc && (
              <img
                src={previewSrc}
                alt=""
                draggable={false}
                style={{
                  position: "absolute",
                  left: photoLeft ? `${photoLeft}px` : 0,
                  top: photoTop ? `${photoTop}px` : 0,
                  width: displayW ? `${displayW}px` : "auto",
                  height: displayH ? `${displayH}px` : "auto",
                  visibility: isReady ? "visible" : "hidden",
                }}
              />
            )}
            {/* Рамка выбора: затемняем всё вокруг гигантской тенью, внутри — сетка третей */}
            {isReady && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute rounded-md ring-2 ring-inset ring-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
                style={{
                  left: `${photoLeft + crop.x * fitScale}px`,
                  top: `${photoTop + crop.y * fitScale}px`,
                  width: `${cropSide * fitScale}px`,
                  height: `${cropSide * fitScale}px`,
                }}
              >
                <div className="absolute left-1/3 top-0 h-full w-px bg-primary-foreground/40" />
                <div className="absolute left-2/3 top-0 h-full w-px bg-primary-foreground/40" />
                <div className="absolute top-1/3 left-0 w-full h-px bg-primary-foreground/40" />
                <div className="absolute top-2/3 left-0 w-full h-px bg-primary-foreground/40" />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8 shrink-0"
              onClick={() => applyZoom(crop.zoom / ZOOM_STEP)}
              disabled={!isReady || crop.zoom <= 1}
              aria-label="Увеличить область выбора"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Slider
              value={[Math.min(MAX_ZOOM, Math.max(1, crop.zoom))]}
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              onValueChange={([value]) => applyZoom(value)}
              disabled={!isReady}
              aria-label="Размер области выбора"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8 shrink-0"
              onClick={() => applyZoom(crop.zoom * ZOOM_STEP)}
              disabled={!isReady || crop.zoom >= MAX_ZOOM}
              aria-label="Уменьшить область выбора"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Фото видно целиком — приближение уменьшает рамку, чтобы вырезать нужный фрагмент.
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
