'use client'

import { useEffect, useState } from 'react'

const SPEAKING_THRESHOLD = 0.035
const SILENCE_DELAY_MS = 450

export function useSpeakingDetector(stream: MediaStream | null, enabled = true) {
  const [isSpeaking, setIsSpeaking] = useState(false)

  useEffect(() => {
    if (!stream || !enabled || stream.getAudioTracks().length === 0) {
      setIsSpeaking(false)
      return
    }

    const audioContext = new AudioContext()
    const source = audioContext.createMediaStreamSource(stream)
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 512
    analyser.smoothingTimeConstant = 0.72
    source.connect(analyser)

    const samples = new Uint8Array(analyser.fftSize)
    let frameId = 0
    let lastVoiceAt = 0
    let speaking = false

    const detect = () => {
      analyser.getByteTimeDomainData(samples)
      let sumSquares = 0
      for (const sample of samples) {
        const normalized = (sample - 128) / 128
        sumSquares += normalized * normalized
      }

      const rms = Math.sqrt(sumSquares / samples.length)
      const now = performance.now()
      if (rms >= SPEAKING_THRESHOLD) lastVoiceAt = now
      const nextSpeaking = now - lastVoiceAt < SILENCE_DELAY_MS

      if (nextSpeaking !== speaking) {
        speaking = nextSpeaking
        setIsSpeaking(nextSpeaking)
      }
      frameId = requestAnimationFrame(detect)
    }

    void audioContext.resume().catch(() => undefined)
    frameId = requestAnimationFrame(detect)

    return () => {
      cancelAnimationFrame(frameId)
      source.disconnect()
      analyser.disconnect()
      void audioContext.close()
      setIsSpeaking(false)
    }
  }, [enabled, stream])

  return isSpeaking
}
