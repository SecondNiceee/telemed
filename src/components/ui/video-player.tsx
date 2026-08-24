'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Play, Pause, Volume2, VolumeX, Download, Maximize, Minimize, SkipBack, SkipForward } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

interface VideoPlayerProps {
  src: string
  title?: string
  poster?: string
  className?: string
  onDownload?: () => void
  /**
   * Известная длительность в секундах (например, из БД). Записи MediaRecorder
   * - потоковый WebM без длительности в заголовке: браузер отдаёт
   * duration = Infinity, и без подсказки плеер показывает 0:00, а перемотка
   * не работает, пока файл не досмотрен до конца.
   */
  durationHint?: number
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function VideoPlayer({ src, title, poster, className, onDownload, durationHint }: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  // durationHint из БД делает плеер рабочим сразу, не дожидаясь метаданных.
  const [duration, setDuration] = useState(durationHint && durationHint > 0 ? durationHint : 0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Флаг «идёт зондирование длительности»: во время принудительной перемотки
  // в конец timeupdate не должен дёргать ползунок.
  const probingRef = useRef(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const applyDuration = () => {
      if (video.duration && isFinite(video.duration)) {
        setDuration(video.duration)
        return true
      }
      return false
    }

    /**
     * Потоковый WebM от MediaRecorder не содержит длительности в заголовке:
     * duration === Infinity. Единственный способ заставить браузер вычислить
     * её (и построить индекс для перемотки) - прыгнуть на "бесконечную"
     * позицию: Chrome/Firefox дочитывают файл, публикуют настоящую duration
     * через durationchange и корректно возвращаются. Без этого перемотка
     * по записи лагает или не работает вовсе.
     */
    const probeInfiniteDuration = () => {
      if (probingRef.current || isFinite(video.duration)) return
      probingRef.current = true
      const onDurationChange = () => {
        if (!isFinite(video.duration)) return
        video.removeEventListener('durationchange', onDurationChange)
        applyDuration()
        video.currentTime = 0
        probingRef.current = false
      }
      video.addEventListener('durationchange', onDurationChange)
      try {
        video.currentTime = Number.MAX_SAFE_INTEGER
      } catch {
        video.removeEventListener('durationchange', onDurationChange)
        probingRef.current = false
      }
    }

    const handleTimeUpdate = () => {
      if (probingRef.current) return
      setCurrentTime(video.currentTime)
      // Fallback-прогресс: если известной длительности всё ещё нет, тянем её
      // вверх за текущей позицией, чтобы ползунок не «упирался».
      if (!isFinite(video.duration) && video.currentTime > 0) {
        setDuration((prev) => Math.max(prev, video.currentTime))
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
      // Реальная длительность точно известна в момент окончания.
      if (video.currentTime > 0) setDuration((prev) => Math.max(prev, video.currentTime))
    }

    const handleCanPlay = () => {
      setIsLoaded(true)
      applyDuration()
    }

    const handleLoadedData = () => {
      setIsLoaded(true)
      applyDuration()
    }

    // isPlaying синхронизируется с реальными событиями элемента, а не с
    // оптимистичным флагом: iOS/автопауза при сворачивании больше не
    // рассинхронизируют кнопку.
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    if (video.readyState >= 1) {
      setIsLoaded(true)
      if (!applyDuration()) probeInfiniteDuration()
    }

    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('durationchange', handleDurationChange)
    video.addEventListener('ended', handleEnded)
    video.addEventListener('canplay', handleCanPlay)
    video.addEventListener('loadeddata', handleLoadedData)
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    document.addEventListener('fullscreenchange', handleFullscreenChange)

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('durationchange', handleDurationChange)
      video.removeEventListener('ended', handleEnded)
      video.removeEventListener('canplay', handleCanPlay)
      video.removeEventListener('loadeddata', handleLoadedData)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  // Auto-hide controls
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
    setShowControls(true)
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false)
      }, 3000)
    }
  }, [isPlaying])

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
    }
  }, [])

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    // Состояние обновят события play/pause; здесь только команда.
    if (video.paused || video.ended) {
      void video.play().catch(() => {})
    } else {
      video.pause()
    }
    resetControlsTimeout()
  }, [resetControlsTimeout])

  const handleSeek = useCallback((value: number[]) => {
    const video = videoRef.current
    if (!video || !isLoaded) return

    const newTime = value[0]
    if (!isFinite(newTime) || newTime < 0) return
    try {
      // Верхняя граница - НАШЕ знание длительности (duration из state), а не
      // video.duration: у записей MediaRecorder оно Infinity, и старая
      // проверка `newTime <= (video.duration || 0)` блокировала перемотку.
      const upperBound = isFinite(video.duration) ? video.duration : duration || newTime
      video.currentTime = Math.min(newTime, upperBound)
      setCurrentTime(video.currentTime)
    } catch (e) {
      console.error('Error seeking video:', e)
    }
  }, [isLoaded, duration])

  const handleVolumeChange = useCallback((value: number[]) => {
    const video = videoRef.current
    if (!video) return

    const newVolume = value[0]
    video.volume = newVolume
    setVolume(newVolume)
    setIsMuted(newVolume === 0)
  }, [])

  const toggleMute = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    if (isMuted) {
      video.volume = volume || 1
      setIsMuted(false)
    } else {
      video.volume = 0
      setIsMuted(true)
    }
  }, [isMuted, volume])

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    if (isFullscreen) {
      document.exitFullscreen()
    } else {
      container.requestFullscreen()
    }
  }, [isFullscreen])

  const skipBack = useCallback(() => {
    const video = videoRef.current
    if (!video || !isLoaded) return
    try {
      video.currentTime = Math.max(0, video.currentTime - 10)
    } catch (e) {
      console.error('Error skipping back:', e)
    }
  }, [isLoaded])

  const skipForward = useCallback(() => {
    const video = videoRef.current
    if (!video || !isLoaded) return
    try {
      const upperBound = isFinite(video.duration) ? video.duration : duration || video.currentTime + 10
      video.currentTime = Math.min(upperBound, video.currentTime + 10)
    } catch (e) {
      console.error('Error skipping forward:', e)
    }
  }, [duration, isLoaded])

  const handleVideoClick = useCallback(() => {
    togglePlay()
  }, [togglePlay])

  const handleMouseMove = useCallback(() => {
    resetControlsTimeout()
  }, [resetControlsTimeout])

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div 
      ref={containerRef}
      className={cn(
        'relative rounded-xl overflow-hidden bg-black group',
        isFullscreen && 'fixed inset-0 z-50 rounded-none',
        className
      )}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        preload="metadata"
        className="w-full aspect-video object-contain bg-black cursor-pointer"
        onClick={handleVideoClick}
      />

      {/* Play button overlay when paused */}
      {!isPlaying && isLoaded && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
          onClick={handleVideoClick}
        >
          <div className="w-20 h-20 rounded-full bg-primary/90 flex items-center justify-center hover:bg-primary transition-colors">
            <Play className="w-10 h-10 text-primary-foreground ml-1" />
          </div>
        </div>
      )}

      {/* Controls overlay */}
      <div 
        className={cn(
          'absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 transition-opacity duration-300',
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        {title && (
          <p className="text-white text-sm font-medium mb-3 truncate">{title}</p>
        )}

        {/* Progress bar */}
        <div className="mb-3">
          <Slider
            value={[currentTime]}
            min={0}
            max={duration || 100}
            step={0.1}
            onValueChange={handleSeek}
            disabled={!isLoaded}
            className="cursor-pointer [&_[role=slider]]:h-5 [&_[role=slider]]:w-5 [&_[role=slider]]:border-2 [&_[role=slider]]:border-white [&_[role=slider]]:bg-primary [&_[role=slider]]:shadow-lg [&_[role=slider]]:transition-transform [&_[role=slider]]:hover:scale-125 [&_.bg-primary]:bg-white [&_[data-disabled]_[role=slider]]:opacity-50"
          />
        </div>

        {/* Controls row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {/* Skip back */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-white hover:bg-white/20"
              onClick={skipBack}
              disabled={!isLoaded}
            >
              <SkipBack className="h-4 w-4" />
            </Button>

            {/* Play/Pause */}
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 text-white hover:bg-white/20"
              onClick={togglePlay}
              disabled={!isLoaded}
            >
              {isPlaying ? (
                <Pause className="h-6 w-6" />
              ) : (
                <Play className="h-6 w-6 ml-0.5" />
              )}
            </Button>

            {/* Skip forward */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-white hover:bg-white/20"
              onClick={skipForward}
              disabled={!isLoaded}
            >
              <SkipForward className="h-4 w-4" />
            </Button>

            {/* Volume */}
            <div className="flex items-center gap-1 ml-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20"
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
                className="w-20 [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:bg-white [&_.bg-primary]:bg-white/80"
              />
            </div>

            {/* Time display */}
            <span className="text-white text-xs ml-3 tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Download */}
            {onDownload && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20"
                onClick={onDownload}
              >
                <Download className="h-4 w-4" />
              </Button>
            )}

            {/* Fullscreen */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={toggleFullscreen}
            >
              {isFullscreen ? (
                <Minimize className="h-4 w-4" />
              ) : (
                <Maximize className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
