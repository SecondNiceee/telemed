'use client'

import { useEffect, useRef } from 'react'
import { User } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RemoteVideoProps } from '@/lib/video-call/types'

export function RemoteVideo({ stream, participantName, className }: RemoteVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const videoElement = videoRef.current
    if (!videoElement || !stream) return
    
    let isCancelled = false
    let playAttemptTimeout: NodeJS.Timeout | null = null
    
    console.log('[v0] RemoteVideo: Setting stream to video element')
    console.log('[v0] RemoteVideo: Stream ID:', stream.id)
    console.log('[v0] RemoteVideo: Audio tracks:', stream.getAudioTracks().length)
    console.log('[v0] RemoteVideo: Video tracks:', stream.getVideoTracks().length)
    
    // Log track details
    stream.getAudioTracks().forEach((track, i) => {
      console.log(`[v0] RemoteVideo: Audio track ${i}: id=${track.id}, enabled=${track.enabled}, muted=${track.muted}, readyState=${track.readyState}`)
    })
    stream.getVideoTracks().forEach((track, i) => {
      console.log(`[v0] RemoteVideo: Video track ${i}: id=${track.id}, enabled=${track.enabled}, muted=${track.muted}, readyState=${track.readyState}`)
    })
    
    // Add event listeners for debugging
    const onLoadedMetadata = () => console.log('[v0] RemoteVideo: loadedmetadata event')
    const onCanPlay = () => console.log('[v0] RemoteVideo: canplay event')
    const onCanPlayThrough = () => console.log('[v0] RemoteVideo: canplaythrough event')
    const onPlaying = () => console.log('[v0] RemoteVideo: playing event')
    const onWaiting = () => console.log('[v0] RemoteVideo: waiting event (buffering)')
    const onStalled = () => console.log('[v0] RemoteVideo: stalled event')
    const onError = (e: Event) => console.error('[v0] RemoteVideo: error event', (e.target as HTMLVideoElement)?.error)
    
    videoElement.addEventListener('loadedmetadata', onLoadedMetadata)
    videoElement.addEventListener('canplay', onCanPlay)
    videoElement.addEventListener('canplaythrough', onCanPlayThrough)
    videoElement.addEventListener('playing', onPlaying)
    videoElement.addEventListener('waiting', onWaiting)
    videoElement.addEventListener('stalled', onStalled)
    videoElement.addEventListener('error', onError)
    
    // Always set srcObject when stream changes (compare by id, not reference)
    const currentStreamId = (videoElement.srcObject as MediaStream)?.id
    if (currentStreamId !== stream.id) {
      console.log('[v0] RemoteVideo: Setting new srcObject, old:', currentStreamId, 'new:', stream.id)
      videoElement.srcObject = stream
    }
    
    // Set volume (muted will be handled during play)
    videoElement.volume = 1.0
    
    // Use a small delay and proper cleanup to avoid AbortError when stream updates rapidly
    const playVideo = async () => {
      if (isCancelled) return
      
      console.log('[v0] RemoteVideo: playVideo called, readyState:', videoElement.readyState)
      
      try {
        // First try to play muted (always allowed by browsers)
        videoElement.muted = true
        console.log('[v0] RemoteVideo: Attempting to play (muted first)')
        await videoElement.play()
        console.log('[v0] RemoteVideo: Playing successfully (muted)')
        console.log('[v0] RemoteVideo: After play - paused:', videoElement.paused, 'readyState:', videoElement.readyState, 'currentTime:', videoElement.currentTime)
        
        // Now try to unmute - this should work since user initiated the call
        videoElement.muted = false
        console.log('[v0] RemoteVideo: Unmuted successfully')
        
        // Monitor video state
        setTimeout(() => {
          if (videoElement && !isCancelled) {
            console.log('[v0] RemoteVideo: Status check after 500ms - paused:', videoElement.paused, 'muted:', videoElement.muted, 'volume:', videoElement.volume, 'currentTime:', videoElement.currentTime, 'readyState:', videoElement.readyState)
          }
        }, 500)
      } catch (err) {
        // AbortError is expected when stream updates quickly - silently ignore
        if (err instanceof Error && err.name === 'AbortError') {
          console.log('[v0] RemoteVideo: play() aborted (expected)')
          return
        }
        // NotAllowedError - try with user gesture
        if (err instanceof Error && err.name === 'NotAllowedError') {
          console.log('[v0] RemoteVideo: Autoplay blocked even muted, waiting for user interaction')
          return
        }
        console.error('[v0] RemoteVideo: Failed to play:', err)
      }
    }
    
    // Wait a bit before playing to allow the stream to stabilize
    playAttemptTimeout = setTimeout(playVideo, 100)

    return () => {
      isCancelled = true
      if (playAttemptTimeout) {
        clearTimeout(playAttemptTimeout)
      }
      // Remove event listeners
      videoElement.removeEventListener('loadedmetadata', onLoadedMetadata)
      videoElement.removeEventListener('canplay', onCanPlay)
      videoElement.removeEventListener('canplaythrough', onCanPlayThrough)
      videoElement.removeEventListener('playing', onPlaying)
      videoElement.removeEventListener('waiting', onWaiting)
      videoElement.removeEventListener('stalled', onStalled)
      videoElement.removeEventListener('error', onError)
    }
  }, [stream])

  if (!stream) {
    return (
      <div
        className={cn(
          'flex h-full w-full flex-col items-center justify-center bg-muted',
          className
        )}
      >
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted-foreground/20">
          <User className="h-12 w-12 text-muted-foreground" />
        </div>
        {participantName && (
          <p className="mt-4 text-lg font-medium text-muted-foreground">{participantName}</p>
        )}
      </div>
    )
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      className={cn('h-full w-full object-cover', className)}
    />
  )
}
