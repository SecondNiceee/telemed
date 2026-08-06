'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Maximize2, PhoneOff, Hand } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { MinimizedViewProps } from '@/lib/video-call/types'

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

interface Position {
  x: number
  y: number
}

interface ExtendedMinimizedViewProps extends MinimizedViewProps {
  isAudioOnly?: boolean
}

export function MinimizedView({
  localStream,
  remoteStream,
  participantName,
  remainingSeconds,
  onExpand,
  onEndCall,
  isAudioOnly,
}: ExtendedMinimizedViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<Position>({ x: 16, y: 16 }) // bottom-right with 16px padding
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<Position>({ x: 0, y: 0 })

  // Set up video element for video calls
  useEffect(() => {
    const videoElement = videoRef.current
    // Show remote stream if available, otherwise local (only for video calls)
    if (!isAudioOnly) {
      const streamToShow = remoteStream || localStream
      if (videoElement && streamToShow) {
        videoElement.srcObject = streamToShow
      }
    }
    return () => {
      if (videoElement) {
        videoElement.srcObject = null
      }
    }
  }, [remoteStream, localStream, isAudioOnly])

  // Set up audio element for audio-only calls (critical for minimized view)
  useEffect(() => {
    const audioElement = audioRef.current
    if (isAudioOnly && audioElement && remoteStream) {
      audioElement.srcObject = remoteStream
      // Ensure audio plays
      audioElement.play().catch((err) => {
        console.warn('[MinimizedView] Failed to play audio:', err)
      })
    }
    return () => {
      if (audioElement) {
        audioElement.srcObject = null
      }
    }
  }, [remoteStream, isAudioOnly])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only start drag if clicking on the drag handle area
    if ((e.target as HTMLElement).closest('[data-drag-handle]')) {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(true)
      setDragStart({
        x: e.clientX + position.x,
        y: e.clientY + position.y,
      })
    }
  }, [position])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return

    const containerWidth = containerRef.current.offsetWidth
    const containerHeight = containerRef.current.offsetHeight
    const windowWidth = window.innerWidth
    const windowHeight = window.innerHeight

    // Calculate new position (from bottom-right)
    let newX = dragStart.x - e.clientX
    let newY = dragStart.y - e.clientY

    // Constrain to viewport
    newX = Math.max(16, Math.min(newX, windowWidth - containerWidth - 16))
    newY = Math.max(16, Math.min(newY, windowHeight - containerHeight - 16))

    setPosition({ x: newX, y: newY })
  }, [isDragging, dragStart])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Add global mouse listeners when dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  // Touch support
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('[data-drag-handle]')) {
      e.stopPropagation()
      const touch = e.touches[0]
      setIsDragging(true)
      setDragStart({
        x: touch.clientX + position.x,
        y: touch.clientY + position.y,
      })
    }
  }, [position])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging || !containerRef.current) return

    const touch = e.touches[0]
    const containerWidth = containerRef.current.offsetWidth
    const containerHeight = containerRef.current.offsetHeight
    const windowWidth = window.innerWidth
    const windowHeight = window.innerHeight

    let newX = dragStart.x - touch.clientX
    let newY = dragStart.y - touch.clientY

    newX = Math.max(16, Math.min(newX, windowWidth - containerWidth - 16))
    newY = Math.max(16, Math.min(newY, windowHeight - containerHeight - 16))

    setPosition({ x: newX, y: newY })
  }, [isDragging, dragStart])

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('touchmove', handleTouchMove, { passive: false })
      document.addEventListener('touchend', handleTouchEnd)
      return () => {
        document.removeEventListener('touchmove', handleTouchMove)
        document.removeEventListener('touchend', handleTouchEnd)
      }
    }
  }, [isDragging, handleTouchMove, handleTouchEnd])

  const handleContainerClick = (e: React.MouseEvent) => {
    // Don't expand if we were dragging
    if (isDragging) {
      e.preventDefault()
      e.stopPropagation()
      return
    }
    // Don't expand if clicking drag handle
    if ((e.target as HTMLElement).closest('[data-drag-handle]')) {
      return
    }
    onExpand()
  }

  return (
    <div
      ref={containerRef}
      style={{
        right: `${position.x}px`,
        bottom: `${position.y}px`,
      }}
      className={cn(
        'group fixed z-50 overflow-hidden rounded-2xl shadow-2xl',
        'h-40 w-56 bg-black',
        isDragging ? 'cursor-grabbing' : 'cursor-pointer',
        !isDragging && 'transition-transform hover:scale-[1.02]'
      )}
      onClick={handleContainerClick}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {/* Hidden audio element for audio-only calls - critical for sound in minimized mode */}
      {isAudioOnly && remoteStream && (
        <audio
          ref={audioRef}
          autoPlay
          playsInline
          className="hidden"
        />
      )}
      
      {/* Video or Audio-only display */}
      {isAudioOnly ? (
        <div className="flex h-full w-full flex-col items-center justify-center bg-white">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <span className="text-2xl font-semibold text-primary">
              {participantName.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      ) : remoteStream || localStream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={!remoteStream}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-muted">
          <span className="text-sm text-muted-foreground">{participantName}</span>
        </div>
      )}

      {/* Overlay */}
      <div className={cn(
        "absolute inset-0",
        isAudioOnly 
          ? "bg-gradient-to-t from-gray-100/80 via-transparent to-gray-100/60" 
          : "bg-gradient-to-t from-black/60 via-transparent to-black/40"
      )}>
        {/* Drag handle - centered */}
        <div
          data-drag-handle
          className={cn(
            "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center",
            "w-12 h-12 rounded-full backdrop-blur-sm",
            isAudioOnly ? "bg-gray-300/50" : "bg-white/30",
            "opacity-0 group-hover:opacity-100 transition-opacity",
            isDragging ? "opacity-100 cursor-grabbing" : "cursor-grab"
          )}
        >
          <Hand className={cn("h-6 w-6", isAudioOnly ? "text-gray-700" : "text-white")} />
        </div>

        {/* Top info */}
        <div className="absolute left-2 top-2 flex items-center gap-2">
          <span className={cn(
            "rounded px-2 py-0.5 text-xs font-mono backdrop-blur-sm",
            isAudioOnly ? "bg-gray-200/80 text-gray-700" : "bg-background/80"
          )}>
            {formatTime(remainingSeconds)}
          </span>
        </div>

        {/* Name */}
        <div className="absolute bottom-2 left-2 right-2">
          <p className={cn(
            "truncate text-sm font-medium",
            isAudioOnly ? "text-gray-700" : "text-white"
          )}>
            {participantName}
          </p>
        </div>

        {/* Expand button */}
        <Button
          variant="secondary"
          size="icon"
          className="absolute right-2 top-2 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation()
            onExpand()
          }}
        >
          <Maximize2 className="h-4 w-4" />
        </Button>

        {/* End call button */}
        <Button
          variant="destructive"
          size="icon"
          className="absolute bottom-2 right-2 h-8 w-8 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation()
            onEndCall()
          }}
        >
          <PhoneOff className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
