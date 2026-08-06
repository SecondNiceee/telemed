'use client'

import { useState, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { getBaseUrl } from '@/lib/api/fetch'
import type { ApiMessageAttachment } from '@/lib/api/messages'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export function useFileUpload(appointmentId: number) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadedAttachment, setUploadedAttachment] = useState<ApiMessageAttachment | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Clear attachment when appointment changes
  const clearAttachment = useCallback(() => {
    setSelectedFile(null)
    setUploadedAttachment(null)
    setIsUploading(false)
  }, [])

  const uploadFile = useCallback(async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      toast.error('Файл слишком большой. Максимальный размер: 10MB')
      return
    }

    setSelectedFile(file)
    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const baseUrl = getBaseUrl()
      const response = await fetch(`${baseUrl}/api/media`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Ошибка загрузки файла')
      }

      const data = await response.json()
      setUploadedAttachment({
        id: data.doc.id,
        url: data.doc.url,
        filename: data.doc.filename,
        mimeType: data.doc.mimeType,
        filesize: data.doc.filesize,
        width: data.doc.width,
        height: data.doc.height,
      })
    } catch (err) {
      console.error('Upload error:', err)
      toast.error('Не удалось загрузить файл')
      setSelectedFile(null)
    } finally {
      setIsUploading(false)
    }
  }, [])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await uploadFile(file)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [uploadFile])

  const handleRemoveAttachment = useCallback(() => {
    setSelectedFile(null)
    setUploadedAttachment(null)
  }, [])

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) {
          await uploadFile(file)
        }
        return
      }
    }
  }, [uploadFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer?.files
    if (files && files.length > 0) {
      await uploadFile(files[0])
    }
  }, [uploadFile])

  const resetAfterSend = useCallback(() => {
    setSelectedFile(null)
    setUploadedAttachment(null)
  }, [])

  return {
    selectedFile,
    uploadedAttachment,
    isUploading,
    isDragging,
    fileInputRef,
    clearAttachment,
    handleFileSelect,
    handleRemoveAttachment,
    handlePaste,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    resetAfterSend,
  }
}
