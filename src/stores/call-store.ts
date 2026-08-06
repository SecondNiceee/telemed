import { create } from 'zustand'
import type Peer from 'peerjs'
import type { MediaConnection } from 'peerjs'

export type CallStatus = 'idle' | 'calling' | 'incoming' | 'connecting' | 'connected' | 'ended'

export interface ActiveCallAppointment {
  appointmentId: number
  doctorConnected: boolean
  userConnected: boolean
  doctorPeerId: string | null
  userPeerId: string | null
}

interface CallState {
  // PeerJS instance
  peer: Peer | null
  peerId: string | null
  
  // Call state
  status: CallStatus
  currentCall: MediaConnection | null
  
  // Streams
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  
  // Call info
  appointmentId: number | null
  remotePeerId: string | null
  callerName: string | null
  remoteAnswered: boolean // Flag to indicate remote peer has answered
  isIncomingAudioOnly: boolean // Flag to indicate this incoming call is audio-only
  
  // Video/Audio toggles
  isVideoEnabled: boolean
  isAudioEnabled: boolean
  
  // User context
  currentSenderType: 'user' | 'doctor' | null
  currentSenderId: number | null
  activeCallAppointment: ActiveCallAppointment | null
  
  // Actions
  setPeer: (peer: Peer | null) => void
  setPeerId: (peerId: string | null) => void
  setStatus: (status: CallStatus) => void
  setCurrentCall: (call: MediaConnection | null) => void
  setLocalStream: (stream: MediaStream | null) => void
  setRemoteStream: (stream: MediaStream | null) => void
  setAppointmentId: (id: number | null) => void
  setRemotePeerId: (peerId: string | null) => void
  setCallerName: (name: string | null) => void
  setRemoteAnswered: (answered: boolean) => void
  toggleVideo: (enabled?: boolean) => void
  toggleAudio: (enabled?: boolean) => void
  setCurrentSenderType: (type: 'user' | 'doctor' | null) => void
  setCurrentSenderId: (id: number | null) => void
  setActiveCallAppointment: (appointment: ActiveCallAppointment | null) => void
  
  // Complex actions
  startCall: (appointmentId: number, remotePeerId: string) => void
  receiveCall: (call: MediaConnection, callerName: string, appointmentId: number, isAudioOnly?: boolean) => void
  endCall: () => void
  reset: () => void
  checkActiveCall: () => Promise<ActiveCallAppointment | null>
  rejoinCall: (appointment: ActiveCallAppointment) => void
}

const initialState = {
  peer: null as Peer | null,
  peerId: null as string | null,
  status: 'idle' as CallStatus,
  currentCall: null as MediaConnection | null,
  localStream: null as MediaStream | null,
  remoteStream: null as MediaStream | null,
  appointmentId: null as number | null,
  remotePeerId: null as string | null,
  callerName: null as string | null,
  remoteAnswered: false,
  isIncomingAudioOnly: false,
  isVideoEnabled: true,
  isAudioEnabled: true,
  currentSenderType: null as 'user' | 'doctor' | null,
  currentSenderId: null as number | null,
  activeCallAppointment: null as ActiveCallAppointment | null,
}

export const useCallStore = create<CallState>((set, get) => ({
  ...initialState,

  setPeer: (peer) => set({ peer }),
  setPeerId: (peerId) => set({ peerId }),
  setStatus: (status) => set({ status }),
  setCurrentCall: (call) => set({ currentCall: call }),
  setLocalStream: (stream) => set({ localStream: stream }),
  setRemoteStream: (stream) => set({ remoteStream: stream }),
  setAppointmentId: (id) => set({ appointmentId: id }),
  setRemotePeerId: (peerId) => set({ remotePeerId: peerId }),
  setCallerName: (name) => set({ callerName: name }),
  setRemoteAnswered: (answered) => set({ remoteAnswered: answered }),
  
  toggleVideo: (enabled?: boolean) => {
    const { localStream, isVideoEnabled } = get()
    const newValue = enabled !== undefined ? enabled : !isVideoEnabled
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = newValue
      })
    }
    set({ isVideoEnabled: newValue })
  },
  
  toggleAudio: (enabled?: boolean) => {
    const { localStream, isAudioEnabled } = get()
    const newValue = enabled !== undefined ? enabled : !isAudioEnabled
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = newValue
      })
    }
    set({ isAudioEnabled: newValue })
  },

  setCurrentSenderType: (type) => set({ currentSenderType: type }),
  setCurrentSenderId: (id) => set({ currentSenderId: id }),
  setActiveCallAppointment: (appointment) => set({ activeCallAppointment: appointment }),

  checkActiveCall: async () => {
    // Check for active call appointment via API
    // This is a placeholder - implement actual API call as needed
    return null
  },

  rejoinCall: (appointment) => {
    set({
      activeCallAppointment: appointment,
      appointmentId: appointment.appointmentId,
      status: 'connecting',
    })
  },

  startCall: (appointmentId, remotePeerId) => {
    set({ 
      appointmentId,
      remotePeerId,
      status: 'calling',
      remoteAnswered: false, // Reset - wait for actual answer
    })
  },

  receiveCall: (call, callerName, appointmentId, isAudioOnly) => {
    set({
      currentCall: call,
      callerName,
      appointmentId,
      status: 'incoming',
      isIncomingAudioOnly: isAudioOnly ?? false,
    })
  },

  endCall: () => {
    const { currentCall, localStream, remoteStream, status } = get()
    
    console.log('[CallStore] endCall called, current status:', status)
    console.trace('[CallStore] endCall trace')
    
    // Close the peer call
    if (currentCall) {
      currentCall.close()
    }
    
    // Stop all tracks
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop())
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => track.stop())
    }
    
    set({
      status: 'ended',
      currentCall: null,
      localStream: null,
      remoteStream: null,
      remotePeerId: null,
      callerName: null,
      appointmentId: null,
      isVideoEnabled: true,
      isAudioEnabled: true,
      remoteAnswered: false,
      isIncomingAudioOnly: false,
    })
    
    // Reset to idle after a short delay
    setTimeout(() => {
      set({ status: 'idle' })
    }, 1000)
  },

  reset: () => {
    const { currentCall, localStream, remoteStream, peer } = get()
    
    if (currentCall) currentCall.close()
    if (localStream) localStream.getTracks().forEach((track) => track.stop())
    if (remoteStream) remoteStream.getTracks().forEach((track) => track.stop())
    if (peer) peer.destroy()
    
    set(initialState)
  },
}))
