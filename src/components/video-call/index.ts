// PeerJS provider (legacy, direct access)
export { VideoCallProvider } from './video-call-provider'

// MediaSoup provider (new, direct access)
export { 
  VideoCallProviderMediaSoup, 
  useVideoCallMediaSoup, 
  useVideoCallMediaSoupSafe 
} from './video-call-provider-mediasoup'

// Provider wrapper with feature flag - RECOMMENDED for use
export { VideoCallProviderWrapper, USE_MEDIASOUP, useVideoCall, useVideoCallSafe } from './video-call-provider-wrapper'

export { VideoCallOverlay } from './video-call-overlay'

// Components
export {
  LocalVideo,
  RemoteVideo,
  CallControls,
  DoctorControls,
  CallTimer,
  ConnectionQualityIndicator,
  EndCallDialog,
} from './components'

// Views
export {
  IncomingCallView,
  CallingView,
  ConnectingView,
  ConnectedView,
  MinimizedView,
} from './views'

// Hooks
export {
  usePeerConnection,
  useMediaStream,
  useCallTimer,
  useConnectionQuality,
  useCallRecording,
  useTurnTest,
  useMediasoupConnection,
} from './hooks'

// Re-export types
export type {
  CallStatus,
  ConnectionQuality,
  CallViewMode,
  CallRole,
  CallParticipant,
  CallData,
  MediaState,
  VideoCallContextValue,
} from '@/lib/video-call/types'
