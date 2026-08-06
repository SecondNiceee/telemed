'use client'

import { useEffect, useRef } from 'react'
import { VideoOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LocalVideoProps } from '@/lib/video-call/types'

export function LocalVideo({
  stream,
  isVideoEnabled,
  isMinimized = false,
  className,
}: LocalVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const videoElement = videoRef.current
    if (videoElement && stream) {
      videoElement.srcObject = stream
    }

    return () => {
      if (videoElement) {
        videoElement.srcObject = null
      }
    }
  }, [stream])

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg bg-muted',
        isMinimized ? 'h-24 w-32' : 'h-32 w-44',
        className
      )}
    >
      {stream && isVideoEnabled ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full scale-x-[-1] object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-muted">
          <VideoOff className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
    </div>
  )
}
