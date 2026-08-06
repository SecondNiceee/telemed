'use client'

import { Pause, Play, CheckCircle, Circle, StopCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { DoctorControlsProps } from '@/lib/video-call/types'

export function DoctorControls({
  isPaused,
  onTogglePause,
  onCompleteConsultation,
  isRecording,
  onToggleRecording,
}: DoctorControlsProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Pause/Resume timer */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={onTogglePause}
            className="gap-2"
          >
            {isPaused ? (
              <>
                <Play className="h-4 w-4" />
                <span>Продолжить</span>
              </>
            ) : (
              <>
                <Pause className="h-4 w-4" />
                <span>Пауза</span>
              </>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isPaused ? 'Продолжить таймер' : 'Поставить таймер на паузу'}
        </TooltipContent>
      </Tooltip>

      {/* Recording toggle (if available) */}
      {onToggleRecording && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isRecording ? 'destructive' : 'outline'}
              size="sm"
              onClick={onToggleRecording}
              className="gap-2"
            >
              {isRecording ? (
                <>
                  <StopCircle className="h-4 w-4" />
                  <span>Остановить</span>
                </>
              ) : (
                <>
                  <Circle className="h-4 w-4 fill-red-500 text-red-500" />
                  <span>Запись</span>
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isRecording ? 'Остановить запись' : 'Начать запись консультации'}
          </TooltipContent>
        </Tooltip>
      )}

      {/* Complete consultation */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="default"
            size="sm"
            onClick={onCompleteConsultation}
            className="gap-2"
          >
            <CheckCircle className="h-4 w-4" />
            <span>Завершить приём</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Завершить консультацию и сохранить данные</TooltipContent>
      </Tooltip>
    </div>
  )
}
