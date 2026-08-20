export interface MicrophoneGate {
  track: MediaStreamTrack
  setEnabled: (enabled: boolean) => void
  close: () => void
}

/** Keeps one microphone capture alive while mute is controlled without reacquiring permission. */
export function createMicrophoneGate(track: MediaStreamTrack): MicrophoneGate {
  let closed = false
  const onEnded = () => { closed = true }
  track.addEventListener('ended', onEnded, { once: true })

  return {
    track,
    setEnabled(enabled) {
      if (!closed && track.readyState === 'live') track.enabled = enabled
    },
    close() {
      if (closed) return
      closed = true
      track.removeEventListener('ended', onEnded)
      track.stop()
    },
  }
}

export async function getStableMicrophone(deviceId?: string): Promise<MicrophoneGate> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      autoGainControl: true,
      echoCancellation: true,
      noiseSuppression: true,
    },
    video: false,
  })
  const track = stream.getAudioTracks()[0]
  if (!track) throw new Error('Микрофон не найден')
  return createMicrophoneGate(track)
}
