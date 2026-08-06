'use client'

import { useVideoCallSafe } from './video-call-provider-wrapper'
import { IncomingCallView } from './views/incoming-call-view'
import { CallingView } from './views/calling-view'
import { ConnectingView } from './views/connecting-view'
import { ConnectedView } from './views/connected-view'
import { MinimizedView } from './views/minimized-view'
import { SavingView } from './views/saving-view'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { CallParticipant } from '@/lib/video-call/types'

/**
 * VideoCallOverlay - Global overlay component for video calls
 * 
 * This component renders the appropriate view based on the current call status.
 * It should be placed at the root level of your app (e.g., in layout.tsx).
 * 
 * Views:
 * - idle: No overlay shown
 * - incoming: Shows incoming call UI with accept/reject buttons
 * - calling: Shows outgoing call UI with cancel button
 * - connecting: Shows connecting spinner
 * - connected: Shows full-screen video call UI (or minimized PiP)
 * - ended: Brief transition state
 */
export function VideoCallOverlay() {
  const videoCall = useVideoCallSafe()
  
  // Show saving overlay when uploading recording
  if (videoCall?.isSavingRecording) {
    return <SavingView isAudioOnly={videoCall.isAudioOnly} />
  }
  
  // Don't render if not in a VideoCallProvider or if idle
  if (!videoCall || videoCall.status === 'idle') {
    return null
  }
  
  const {
    status,
    callData,
    localStream,
    remoteStream,
    mediaState,
    connectionQuality,
    remainingSeconds,
    isPaused,
    viewMode,
    role,
    answerCall,
    rejectCall,
    endCall,
    toggleVideo,
    toggleAudio,
    toggleMinimize,
    currentUser,
    isAudioOnly,
  } = videoCall
  
  // Get isServerRecording if available (MediaSoup provider only)
  const isServerRecording = 'isServerRecording' in videoCall ? (videoCall as { isServerRecording?: boolean }).isServerRecording : false
  
  // Get the other participant
  const participant: CallParticipant | null = callData
    ? (currentUser?.peerId === callData.caller.peerId ? callData.callee : callData.caller)
    : null
  
  // Minimized view (PiP mode when connected)
  if (status === 'connected' && viewMode === 'minimized' && participant) {
    return (
      <MinimizedView
        localStream={localStream}
        remoteStream={remoteStream}
        participantName={participant.odooPartnerName}
        remainingSeconds={remainingSeconds}
        onExpand={toggleMinimize}
        onEndCall={endCall}
        isAudioOnly={isAudioOnly}
      />
    )
  }
  
  // Full-screen overlay for all other states
  return (
    <TooltipProvider>
      <div
        className={cn(
          'fixed inset-0 z-50 bg-background',
          status === 'ended' && 'animate-out fade-out duration-300'
        )}
      >
        {/* Incoming call */}
        {status === 'incoming' && participant && (
          <IncomingCallView
            caller={participant}
            onAccept={answerCall}
            onReject={rejectCall}
          />
        )}
        
        {/* Outgoing call (calling) */}
        {status === 'calling' && participant && (
          <CallingView
            callee={participant}
            onCancel={endCall}
          />
        )}
        
        {/* Connecting */}
        {(status === 'connecting' || status === 'reconnecting') && participant && (
          <ConnectingView participant={participant} />
        )}
        
        {/* Connected (full-screen) */}
        {status === 'connected' && viewMode === 'fullscreen' && participant && (
          <ConnectedView
            localStream={localStream}
            remoteStream={remoteStream}
            participant={participant}
            mediaState={mediaState}
            connectionQuality={connectionQuality}
            remainingSeconds={remainingSeconds}
            isPaused={isPaused}
            isMinimized={false}
            onToggleVideo={toggleVideo}
            onToggleAudio={toggleAudio}
            onEndCall={endCall}
            onToggleMinimize={toggleMinimize}
            isAudioOnly={isAudioOnly}
            isServerRecording={isServerRecording}
          />
        )}
        
        {/* Ended state - brief flash */}
        {status === 'ended' && (
          <div className="flex h-full w-full items-center justify-center">
            <p className="text-lg text-muted-foreground">Звонок завершён</p>
          </div>
        )}
        
        {/* Error state */}
        {status === 'error' && (
          <div className="flex h-full w-full flex-col items-center justify-center gap-4">
            <p className="text-lg text-destructive">Ошибка соединения</p>
            <button
              onClick={endCall}
              className="rounded-lg bg-muted px-4 py-2 text-sm hover:bg-muted/80"
            >
              Закрыть
            </button>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
