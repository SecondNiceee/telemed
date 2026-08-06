'use client'

import { useState, useEffect, useRef } from 'react'
import { Circle } from 'lucide-react'
import { LocalVideo } from '../components/local-video'
import { RemoteVideo } from '../components/remote-video'
import { CallControls } from '../components/call-controls'
import { CallTimer } from '../components/call-timer'
import { ConnectionQualityIndicator } from '../components/connection-quality'
import { EndCallDialog } from '../components/end-call-dialog'
import { cn } from '@/lib/utils'
import type { ConnectedViewProps } from '@/lib/video-call/types'

interface ExtendedConnectedViewProps extends ConnectedViewProps {
  isServerRecording?: boolean
  isAudioOnly?: boolean
}

export function ConnectedView({
  localStream,
  remoteStream,
  participant,
  mediaState,
  connectionQuality,
  remainingSeconds,
  isPaused,
  isMinimized,
  onToggleVideo,
  onToggleAudio,
  onEndCall,
  onToggleMinimize,
  isServerRecording,
  isAudioOnly,
}: ExtendedConnectedViewProps) {
  const [showEndDialog, setShowEndDialog] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const audioRef = useRef<HTMLAudioElement>(null)

  // For audio-only calls, we need to play the remote audio stream via audio element
  // For video calls, the video element handles both audio and video, so we don't need backup audio
  useEffect(() => {
    const audioElement = audioRef.current
    if (!audioElement || !remoteStream) return
    
    // Only use audio element for audio-only calls
    // For video calls, the RemoteVideo component handles playback
    if (!isAudioOnly) return
    
    let isCancelled = false
    let playAttemptTimeout: NodeJS.Timeout | null = null
    
    console.log('[v0] ConnectedView: Setting up audio element for audio-only call')
    console.log('[v0] ConnectedView: Audio tracks:', remoteStream.getAudioTracks().length)
    
    // Compare by stream id, not reference
    const currentStreamId = (audioElement.srcObject as MediaStream)?.id
    if (currentStreamId !== remoteStream.id) {
      console.log('[v0] ConnectedView: Setting new audio srcObject, old:', currentStreamId, 'new:', remoteStream.id)
      audioElement.srcObject = remoteStream
    }
    audioElement.volume = 1.0
    
    const playAudio = async () => {
      if (isCancelled) return
      
      try {
        // First try muted (always allowed)
        audioElement.muted = true
        console.log('[v0] ConnectedView: Attempting audio play (muted first)')
        await audioElement.play()
        console.log('[v0] ConnectedView: Audio playing successfully (muted)')
        
        // Now unmute
        try {
          audioElement.muted = false
          console.log('[v0] ConnectedView: Audio unmuted successfully')
        } catch {
          console.log('[v0] ConnectedView: Could not unmute audio')
        }
      } catch (err) {
        // Silently ignore AbortError - it's expected when stream updates
        if (err instanceof Error && err.name === 'AbortError') {
          return
        }
        if (err instanceof Error && err.name === 'NotAllowedError') {
          console.log('[v0] ConnectedView: Audio autoplay blocked even muted')
          return
        }
        console.error('[v0] ConnectedView: Failed to play audio:', err)
      }
    }
    
    // Wait a bit before playing to allow the stream to stabilize
    playAttemptTimeout = setTimeout(playAudio, 100)
    
    return () => {
      isCancelled = true
      if (playAttemptTimeout) {
        clearTimeout(playAttemptTimeout)
      }
    }
  }, [isAudioOnly, remoteStream])

  const handleEndCallClick = () => {
    setShowEndDialog(true)
  }

  const handleConfirmEnd = () => {
    setShowEndDialog(false)
    onEndCall()
  }

  return (
    <div
      className={cn(
        "relative h-full w-full",
        isAudioOnly ? "bg-white" : "bg-black"
      )}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
      onClick={() => setShowControls((prev) => !prev)}
    >
      {/* Hidden audio element for audio-only calls */}
      {isAudioOnly && <audio ref={audioRef} autoPlay playsInline className="hidden" />}

      {/* For audio calls: white background with participant name */}
      {isAudioOnly ? (
        <div className="flex h-full w-full flex-col items-center justify-center">
          <div className="flex h-32 w-32 items-center justify-center rounded-full bg-primary/10">
            <span className="text-5xl font-semibold text-primary">
              {participant.odooPartnerName.charAt(0).toUpperCase()}
            </span>
          </div>
          <p className="mt-6 text-2xl font-medium text-foreground">
            {participant.odooPartnerName}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">Аудиозвонок</p>
        </div>
      ) : (
        /* Remote video (full screen) */
        <RemoteVideo
          stream={remoteStream}
          participantName={participant.odooPartnerName}
          className="h-full w-full"
        />
      )}

      {/* Top overlay - timer, recording indicator and quality */}
      <div
        className={cn(
          'absolute left-0 right-0 top-0 flex items-start justify-between p-4 transition-opacity duration-300',
          showControls ? 'opacity-100' : 'opacity-0'
        )}
      >
        <div className="flex items-center gap-3">
          <CallTimer
            remainingSeconds={remainingSeconds}
            isPaused={isPaused}
          />
          {/* Server recording indicator */}
          {isServerRecording && (
            <div className="flex items-center gap-1.5 rounded-full bg-red-500/90 px-2.5 py-1 text-white backdrop-blur-sm">
              <Circle className="h-2.5 w-2.5 animate-pulse fill-current" />
              <span className="text-xs font-medium">REC</span>
            </div>
          )}
        </div>
        <ConnectionQualityIndicator quality={connectionQuality} showLabel />
      </div>

      {/* Local video (PiP) - hidden for audio-only calls */}
      {!isAudioOnly && (
        <div className="absolute bottom-24 right-4">
          <LocalVideo
            stream={localStream}
            isVideoEnabled={mediaState.isVideoEnabled}
            className="shadow-lg"
          />
        </div>
      )}

      {/* Bottom overlay - controls */}
      <div
        className={cn(
          'absolute bottom-0 left-0 right-0 flex flex-col items-center gap-4 p-4 pb-6 transition-opacity duration-300',
          isAudioOnly ? 'bg-gradient-to-t from-white/80 to-transparent' : 'bg-gradient-to-t from-black/80 to-transparent',
          showControls ? 'opacity-100' : 'opacity-0'
        )}
      >
        {/* Main controls */}
        <CallControls
          isVideoEnabled={mediaState.isVideoEnabled}
          isAudioEnabled={mediaState.isAudioEnabled}
          isCameraAvailable={mediaState.isCameraAvailable}
          isMicrophoneAvailable={mediaState.isMicrophoneAvailable}
          onToggleVideo={onToggleVideo}
          onToggleAudio={onToggleAudio}
          onEndCall={handleEndCallClick}
          onToggleMinimize={onToggleMinimize}
          isMinimized={isMinimized}
          isAudioOnly={isAudioOnly}
        />
      </div>

      {/* Participant name overlay - hidden for audio-only (shown in center instead) */}
      {!isAudioOnly && (
        <div className="absolute bottom-4 left-4">
          <div className="rounded-full bg-background/80 px-3 py-1.5 backdrop-blur-sm">
            <span className="text-sm font-medium">{participant.odooPartnerName}</span>
          </div>
        </div>
      )}

      {/* End call confirmation dialog */}
      <EndCallDialog
        open={showEndDialog}
        onOpenChange={setShowEndDialog}
        onConfirm={handleConfirmEnd}
      />
    </div>
  )
}
