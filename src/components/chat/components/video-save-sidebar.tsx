'use client'

import { Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { VideoSaveSidebarProps } from '../types'

export function VideoSaveSidebar({ isVisible, progress, status }: VideoSaveSidebarProps) {
  if (!isVisible) return null

  return (
    <div className="fixed right-4 top-1/2 -translate-y-1/2 z-50 w-72 bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
      <div className="p-4 border-b border-border bg-muted/50">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center',
            status === 'done' ? 'bg-green-100' : 
            status === 'error' ? 'bg-red-100' : 'bg-primary/10'
          )}>
            {status === 'done' ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : status === 'error' ? (
              <AlertCircle className="w-5 h-5 text-red-600" />
            ) : (
              <Upload className="w-5 h-5 text-primary" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-sm text-foreground">
              {status === 'done' ? 'Готово!' : 
               status === 'error' ? 'Ошибка' : 
               'Сохранение записи'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {status === 'uploading' && 'Загрузка видео...'}
              {status === 'processing' && 'Обработка...'}
              {status === 'saving' && 'Сохранение в базу...'}
              {status === 'done' && 'Запись сохранена'}
              {status === 'error' && 'Не удалось сохранить'}
            </p>
          </div>
        </div>
      </div>
      
      <div className="p-4">
        {/* Progress bar */}
        {status === 'uploading' && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Загрузка</span>
              <span className="font-mono">{progress}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
        
        {/* Processing/Saving indicator */}
        {(status === 'processing' || status === 'saving') && (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}
        
        {/* Done state */}
        {status === 'done' && (
          <p className="text-sm text-center text-green-600">
            Видео консультации успешно сохранено
          </p>
        )}
        
        {/* Error state */}
        {status === 'error' && (
          <p className="text-sm text-center text-red-600">
            Попробуйте сохранить запись позже
          </p>
        )}
      </div>
    </div>
  )
}
