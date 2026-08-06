'use client'

import { useCallback, useRef, useState } from 'react'
import { MEDIA_CONSTRAINTS, CALL_TIMEOUTS } from '@/lib/video-call/config'
import type { UseMediaStreamReturn } from '@/lib/video-call/types'

export function useMediaStream(): UseMediaStreamReturn {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [isCameraAvailable, setIsCameraAvailable] = useState(true)
  const [isMicrophoneAvailable, setIsMicrophoneAvailable] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const streamRef = useRef<MediaStream | null>(null)

  const getStream = useCallback(
    async (video = true, audio = true): Promise<MediaStream | null> => {
      try {
        // Log available devices
        try {
          const devices = await navigator.mediaDevices.enumerateDevices()
          const videoDevices = devices.filter(d => d.kind === 'videoinput')
          const audioDevices = devices.filter(d => d.kind === 'audioinput')
          console.log('[v0] Available video devices:', videoDevices.length, videoDevices.map(d => d.label || d.deviceId))
          console.log('[v0] Available audio devices:', audioDevices.length, audioDevices.map(d => d.label || d.deviceId))
        } catch (e) {
          console.log('[v0] Could not enumerate devices:', e)
        }
        
        // Stop existing stream first
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop())
        }

        // Try with ideal constraints first
        let mediaStream: MediaStream | null = null

        if (video && audio) {
          try {
            mediaStream = await navigator.mediaDevices.getUserMedia({
              video: MEDIA_CONSTRAINTS.video.ideal,
              audio: MEDIA_CONSTRAINTS.audio,
            })
            setIsCameraAvailable(true)
            setIsMicrophoneAvailable(true)
          } catch {
            console.log('[useMediaStream] Failed with ideal constraints, trying fallback')
            // Try with fallback video constraints
          try {
            mediaStream = await navigator.mediaDevices.getUserMedia({
              video: MEDIA_CONSTRAINTS.video.fallback,
              audio: MEDIA_CONSTRAINTS.audio,
            })
            console.log('[useMediaStream] Got stream with fallback constraints')
            setIsCameraAvailable(true)
            setIsMicrophoneAvailable(true)
          } catch {
            console.log('[useMediaStream] Failed with fallback, trying minimal video')
            // Try with minimal video constraints (just true)
            try {
              mediaStream = await navigator.mediaDevices.getUserMedia({
                video: MEDIA_CONSTRAINTS.video.minimal,
                audio: MEDIA_CONSTRAINTS.audio,
              })
              console.log('[useMediaStream] Got stream with minimal constraints')
              setIsCameraAvailable(true)
              setIsMicrophoneAvailable(true)
            } catch {
              console.log('[useMediaStream] Failed with video, trying audio only')
              // Fall back to audio only
              try {
                mediaStream = await navigator.mediaDevices.getUserMedia({
                  video: false,
                  audio: MEDIA_CONSTRAINTS.audio,
                })
                setIsCameraAvailable(false)
                setIsMicrophoneAvailable(true)
              } catch (audioErr) {
                console.error('[useMediaStream] Failed to get any media:', audioErr)
                setIsCameraAvailable(false)
                setIsMicrophoneAvailable(false)
                throw audioErr
              }
            }
          }
          }
        } else if (audio && !video) {
          try {
            mediaStream = await navigator.mediaDevices.getUserMedia({
              video: false,
              audio: MEDIA_CONSTRAINTS.audio,
            })
            setIsCameraAvailable(false)
            setIsMicrophoneAvailable(true)
          } catch (err) {
            setIsMicrophoneAvailable(false)
            throw err
          }
        } else if (video && !audio) {
          try {
            mediaStream = await navigator.mediaDevices.getUserMedia({
              video: MEDIA_CONSTRAINTS.video.ideal,
              audio: false,
            })
            setIsCameraAvailable(true)
            setIsMicrophoneAvailable(false)
          } catch {
            try {
              mediaStream = await navigator.mediaDevices.getUserMedia({
                video: MEDIA_CONSTRAINTS.video.fallback,
                audio: false,
              })
              setIsCameraAvailable(true)
              setIsMicrophoneAvailable(false)
            } catch (err) {
              setIsCameraAvailable(false)
              throw err
            }
          }
        }

        if (mediaStream) {
          streamRef.current = mediaStream
          setStream(mediaStream)
          setError(null)

          // Set initial enabled states based on tracks
          const videoTrack = mediaStream.getVideoTracks()[0]
          const audioTrack = mediaStream.getAudioTracks()[0]
          setIsVideoEnabled(videoTrack?.enabled ?? false)
          setIsAudioEnabled(audioTrack?.enabled ?? false)
          
          // Log actual video quality
          if (videoTrack) {
            const settings = videoTrack.getSettings()
            console.log('[v0] Video track settings:', {
              width: settings.width,
              height: settings.height,
              frameRate: settings.frameRate,
              deviceId: settings.deviceId,
              facingMode: settings.facingMode,
            })
          }
          if (audioTrack) {
            const settings = audioTrack.getSettings()
            console.log('[v0] Audio track settings:', {
              sampleRate: settings.sampleRate,
              echoCancellation: settings.echoCancellation,
              noiseSuppression: settings.noiseSuppression,
            })
          }
        }

        return mediaStream
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to get media stream')
        console.error('[useMediaStream] Error:', error)
        setError(error)
        return null
      }
    },
    []
  )

  const toggleVideo = useCallback(() => {
    if (!streamRef.current) return

    const videoTrack = streamRef.current.getVideoTracks()[0]
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled
      setIsVideoEnabled(videoTrack.enabled)
      console.log('[useMediaStream] Video toggled:', videoTrack.enabled)
    }
  }, [])

  const toggleAudio = useCallback(() => {
    if (!streamRef.current) return

    const audioTrack = streamRef.current.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled
      setIsAudioEnabled(audioTrack.enabled)
      console.log('[useMediaStream] Audio toggled:', audioTrack.enabled)
    }
  }, [])

  const replaceVideoTrack = useCallback((newTrack: MediaStreamTrack) => {
    if (!streamRef.current) return

    const oldTrack = streamRef.current.getVideoTracks()[0]
    if (oldTrack) {
      streamRef.current.removeTrack(oldTrack)
      oldTrack.stop()
    }
    streamRef.current.addTrack(newTrack)
    setIsVideoEnabled(newTrack.enabled)
    console.log('[useMediaStream] Video track replaced')
  }, [])

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop()
        console.log(`[useMediaStream] Stopped track: ${track.kind}`)
      })
      streamRef.current = null
      setStream(null)
      setIsVideoEnabled(false)
      setIsAudioEnabled(false)
    }
  }, [])

  return {
    stream,
    isVideoEnabled,
    isAudioEnabled,
    isCameraAvailable,
    isMicrophoneAvailable,
    error,
    getStream,
    toggleVideo,
    toggleAudio,
    replaceVideoTrack,
    stopStream,
  }
}
