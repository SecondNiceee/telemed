'use client'

import { Upload } from 'lucide-react'

interface DragDropOverlayProps {
  isVisible: boolean
}

export function DragDropOverlay({ isVisible }: DragDropOverlayProps) {
  if (!isVisible) return null

  return (
    <div className="absolute inset-0 z-50 bg-primary/10 backdrop-blur-sm flex items-center justify-center pointer-events-none">
      <div className="bg-card border-2 border-dashed border-primary rounded-xl p-8 flex flex-col items-center gap-3">
        <Upload className="w-12 h-12 text-primary" />
        <p className="text-lg font-medium text-foreground">Отпустите файл для загрузки</p>
        <p className="text-sm text-muted-foreground">Поддерживаются изображения и документы до 10MB</p>
      </div>
    </div>
  )
}
