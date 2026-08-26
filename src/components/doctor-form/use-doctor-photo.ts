"use client"

import React, { useCallback, useState } from "react"
import type { CropRect, CropSource } from "@/components/image-cropper-dialog"

/** Больше этого фото не принимаем: 10 МБ. */
const MAX_SIZE_BYTES = 10 * 1024 * 1024

/**
 * Состояние фотографии врача: выбор файла, кроп, удаление.
 *
 * Логика была продублирована в create и edit почти дословно. Здесь она в одном
 * месте и покрывает оба случая сразу: create просто никогда не заполняет
 * originalUrl и existing*Id, поэтому ведёт себя точно так же, как раньше.
 *
 * Смысл двух версий фото: photo - это обрезанный квадрат, который показывается
 * в интерфейсе, а originalFile/originalUrl - исходник. Исходник нужен, чтобы
 * область кропа можно было выбрать заново без потери качества: кропать уже
 * обрезанный квадрат значит терять пиксели безвозвратно.
 */
export function useDoctorPhoto(onError: (message: string | null) => void) {
  /** Новый обрезанный квадрат, ещё не загруженный на сервер. */
  const [photo, setPhoto] = useState<File | null>(null)
  /** Что видно в форме: всегда обрезанный вариант. */
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  /** Новый оригинал, ещё не загруженный на сервер. */
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  /** Оригинал, уже лежащий на сервере — источник для повторного кропа. */
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)
  /** Что кропаем — пока не null, открыт редактор области. */
  const [cropSource, setCropSource] = useState<CropSource | null>(null)
  /** Ранее выбранная область, чтобы рамка открывалась там же. */
  const [cropRect, setCropRect] = useState<CropRect | null>(null)
  const [existingPhotoId, setExistingPhotoId] = useState<number | null>(null)
  const [existingOriginalId, setExistingOriginalId] = useState<number | null>(null)

  /**
   * Менять область можно только когда есть оригинал. У врачей, заведённых до
   * появления photoOriginal, его нет — кропать уже обрезанное фото значит
   * терять качество без возможности расширить кадр назад.
   */
  const canEditCropArea = Boolean(originalFile || originalUrl)

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Сбрасываем input, иначе повторный выбор того же файла не вызовет change.
    e.target.value = ""
    if (!file) return

    if (file.size > MAX_SIZE_BYTES) {
      onError("Максимальный размер фото 10 МБ, сожмите его или используйте другое")
      return
    }

    onError(null)
    // Область от прежнего фото к новому не относится — рамка откроется по центру.
    setCropRect(null)
    // Сначала кроп — в photo должен попасть уже квадрат.
    setCropSource({ kind: "file", file })
  }

  /** Повторный выбор области: кропаем оригинал, а не уже обрезанный квадрат. */
  function editCropArea() {
    if (originalFile) {
      setCropSource({ kind: "file", file: originalFile })
      return
    }
    if (originalUrl) {
      setCropSource({
        kind: "url",
        url: originalUrl,
        name: originalUrl.split("/").pop() || "photo",
      })
    }
  }

  function handleCropApply({ file, crop }: { file: File; crop: CropRect }) {
    // Старый preview мог быть blob-URL от предыдущего кропа.
    if (photoPreview?.startsWith("blob:")) URL.revokeObjectURL(photoPreview)
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
    setCropRect(crop)

    // Кропали только что выбранный файл — он становится новым оригиналом
    // и вытесняет прежний. При кропе по URL оригинал остаётся тем же.
    if (cropSource?.kind === "file") {
      setOriginalFile(cropSource.file)
      setOriginalUrl(null)
    }

    setCropSource(null)
  }

  const removePhoto = useCallback(() => {
    // Снимаем обе версии сразу: на сервере их удалит хук коллекции doctors.
    setPhoto(null)
    setOriginalFile(null)
    setOriginalUrl(null)
    setExistingPhotoId(null)
    setExistingOriginalId(null)
    setCropRect(null)
    setPhotoPreview((current) => {
      if (current?.startsWith("blob:")) URL.revokeObjectURL(current)
      return null
    })
  }, [])

  /**
   * Подставляет то, что уже сохранено у врача. Нужно только экрану
   * редактирования; create эту функцию не вызывает.
   */
  const hydrate = useCallback(
    (saved: {
      photoUrl?: string | null
      photoId?: number | null
      originalUrl?: string | null
      originalId?: number | null
      crop?: CropRect | null
    }) => {
      if (saved.photoUrl) setPhotoPreview(saved.photoUrl)
      if (saved.photoId != null) setExistingPhotoId(saved.photoId)
      // Оригинал не показываем, он нужен только для повторного кропа.
      if (saved.originalUrl) setOriginalUrl(saved.originalUrl)
      if (saved.originalId != null) setExistingOriginalId(saved.originalId)
      if (saved.crop) setCropRect(saved.crop)
    },
    [],
  )

  return {
    photo,
    photoPreview,
    originalFile,
    cropSource,
    cropRect,
    existingPhotoId,
    existingOriginalId,
    canEditCropArea,
    handlePhotoChange,
    editCropArea,
    handleCropApply,
    removePhoto,
    closeCropper: () => setCropSource(null),
    hydrate,
  }
}

export type DoctorPhotoState = ReturnType<typeof useDoctorPhoto>
