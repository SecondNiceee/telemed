'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Play, Pause, Volume2, VolumeX, Download, Music } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

interface AudioPlayerProps {
  src: string
  title?: string
  className?: string
  onDownload?: () => void
  /**
   * Известная длительность в секундах (например, из БД). Записи MediaRecorder
   * - потоковый WebM без длительности в заголовке (duration = Infinity),
   * без подсказки плеер показывает 0:00 и не даёт перематывать.
   */
  durationHint?: number
}

/**
 * Сколько ждать, пока браузер вычислит длительность потокового WebM.
 * По истечении сдаёмся: лучше приблизительная длительность, чем замерший
 * на 0:00 таймер.
 */
const PROBE_TIMEOUT_MS = 3000

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function AudioPlayer({ src, title, className, onDownload, durationHint }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  // durationHint из БД делает плеер рабочим сразу, не дожидаясь метаданных.
  const [duration, setDuration] = useState(durationHint && durationHint > 0 ? durationHint : 0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  // Флаг «идёт зондирование длительности» - см. probeInfiniteDuration.
  const probingRef = useRef(false)
  // Страховочный таймер: без него probingRef залипал в true, и таймер стоял
  // на 0:00, пока запись играла.
  const probeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const hasDurationHint = !!durationHint && durationHint > 0

    const applyDuration = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration)
        return true
      }
      return false
    }

    /**
     * Потоковый WebM от MediaRecorder отдаёт duration = Infinity. Прыжок на
     * "бесконечную" позицию заставляет браузер дочитать файл и вычислить
     * настоящую длительность.
     *
     * Применяем только как последнее средство: при известной длительности из
     * БД зондировать нечего, а на длинной записи прыжок в конец тянет весь
     * файл. И зондирование обязано завершиться по таймауту — иначе на больших
     * WebM без индекса Cues probingRef залипал навсегда, timeupdate
     * игнорировался, и время стояло на 0:00 при играющей записи.
     */
    const probeInfiniteDuration = () => {
      if (hasDurationHint) return
      if (probingRef.current || isFinite(audio.duration)) return

      probingRef.current = true
      const resumeFrom = audio.currentTime

      const finishProbe = (restorePosition: boolean) => {
        audio.removeEventListener('durationchange', onDurationChange)
        if (probeTimeoutRef.current) {
          clearTimeout(probeTimeoutRef.current)
          probeTimeoutRef.current = null
        }
        probingRef.current = false
        if (restorePosition) {
          try {
            audio.currentTime = resumeFrom
          } catch {
            // Позицию подхватит следующий timeupdate.
          }
        }
        setCurrentTime(audio.currentTime)
      }

      const onDurationChange = () => {
        if (!isFinite(audio.duration)) return
        applyDuration()
        finishProbe(true)
      }

      audio.addEventListener('durationchange', onDurationChange)
      probeTimeoutRef.current = setTimeout(() => finishProbe(true), PROBE_TIMEOUT_MS)

      try {
        audio.currentTime = Number.MAX_SAFE_INTEGER
      } catch {
        finishProbe(false)
      }
    }

    const handleTimeUpdate = () => {
      if (probingRef.current) return
      setCurrentTime(audio.currentTime)
      if (!isFinite(audio.duration) && audio.currentTime > 0) {
        setDuration((prev) => Math.max(prev, audio.currentTime))
      }
    }

    const handleLoadedMetadata = () => {
      setIsLoaded(true)
      if (!applyDuration()) probeInfiniteDuration()
    }

    const handleDurationChange = () => {
      applyDuration()
    }

    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
    }

    const handleCanPlay = () => {
      setIsLoaded(true)
      applyDuration()
    }

    // isPlaying синхронизируется с реальными событиями элемента.
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)

    if (audio.readyState >= 1) {
      setIsLoaded(true)
      if (!applyDuration()) probeInfiniteDuration()
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('durationchange', handleDurationChange)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('canplay', handleCanPlay)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('durationchange', handleDurationChange)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('canplay', handleCanPlay)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      if (probeTimeoutRef.current) {
        clearTimeout(probeTimeoutRef.current)
        probeTimeoutRef.current = null
      }
      probingRef.current = false
    }
  }, [durationHint])

  // Подсказка из БД может приехать после монтирования — подхватываем её, не
  // перетирая настоящую длительность, если браузер её уже вычислил.
  useEffect(() => {
    if (!durationHint || durationHint <= 0) return
    const audio = audioRef.current
    if (audio && isFinite(audio.duration)) return
    setDuration((prev) => (prev > 0 ? prev : durationHint))
  }, [durationHint])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    // Состояние обновят события play/pause; здесь только команда.
    if (audio.paused || audio.ended) {
      void audio.play().catch(() => {})
    } else {
      audio.pause()
    }
  }, [])

  const handleSeek = useCallback((value: number[]) => {
    const audio = audioRef.current
    if (!audio || !isLoaded) return

    const newTime = value[0]
    if (!isFinite(newTime) || newTime < 0) return
    try {
      // Верхняя граница - наше знание длительности, а не audio.duration:
      // у записей MediaRecorder оно Infinity, и старая проверка блокировала
      // перемотку полностью.
      const upperBound = isFinite(audio.duration) ? audio.duration : duration || newTime
      audio.currentTime = Math.min(newTime, upperBound)
      setCurrentTime(audio.currentTime)
    } catch (e) {
      console.error('Error seeking audio:', e)
    }
  }, [isLoaded, duration])

  const handleVolumeChange = useCallback((value: number[]) => {
    const audio = audioRef.current
    if (!audio) return

    const newVolume = value[0]
    audio.volume = newVolume
    setVolume(newVolume)
    setIsMuted(newVolume === 0)
  }, [])

  const toggleMute = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    if (isMuted) {
      audio.volume = volume || 1
      setIsMuted(false)
    } else {
      audio.volume = 0
      setIsMuted(true)
    }
  }, [isMuted, volume])

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className={cn('rounded-xl border border-border bg-card p-4', className)}>
      <audio ref={audioRef} src={src} preload="metadata" />
      
      <div className="flex items-center gap-4">
        {/* Music icon background */}
        <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Music className="w-8 h-8 text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Title */}
          {title && (
            <p className="font-medium text-foreground truncate mb-2">{title}</p>
          )}

          {/* Progress bar */}
          <div className="mb-2">
            <Slider
              value={[currentTime]}
              min={0}
              max={duration || 100}
              step={0.1}
              onValueChange={handleSeek}
              disabled={!isLoaded}
              className="cursor-pointer [&_[role=slider]]:h-4 [&_[role=slider]]:w-4 [&_[role=slider]]:border-2 [&_[role=slider]]:border-primary [&_[role=slider]]:bg-background [&_[role=slider]]:shadow-md [&_[role=slider]]:transition-transform [&_[role=slider]]:hover:scale-110 [&_[data-disabled]_[role=slider]]:opacity-50"
            />
          </div>

          {/* Time display */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
        <div className="flex items-center gap-2">
          {/* Play/Pause button */}
          <Button
            variant="default"
            size="icon"
            className="h-10 w-10 rounded-full"
            onClick={togglePlay}
            disabled={!isLoaded}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 ml-0.5" />
            )}
          </Button>

          {/* Volume control */}
          <div className="flex items-center gap-2 ml-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={toggleMute}
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
            <Slider
              value={[isMuted ? 0 : volume]}
              min={0}
              max={1}
              step={0.01}
              onValueChange={handleVolumeChange}
              className="w-20 [&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
            />
          </div>
        </div>

        {/* Download button */}
        {onDownload && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDownload}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Скачать
          </Button>
        )}
      </div>
    </div>
  )
}
