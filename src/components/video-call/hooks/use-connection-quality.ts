'use client'

import { useCallback, useRef, useState } from 'react'
import { CALL_TIMEOUTS } from '@/lib/video-call/config'
import type { ConnectionQuality, ConnectionStats, UseConnectionQualityReturn } from '@/lib/video-call/types'

function calculateQuality(packetLoss: number, rtt: number): ConnectionQuality {
  // Excellent: <1% packet loss, <100ms RTT
  if (packetLoss < 1 && rtt < 100) return 'excellent'
  // Good: <3% packet loss, <200ms RTT
  if (packetLoss < 3 && rtt < 200) return 'good'
  // Fair: <5% packet loss, <400ms RTT
  if (packetLoss < 5 && rtt < 400) return 'fair'
  // Poor: anything worse
  return 'poor'
}

export function useConnectionQuality(): UseConnectionQualityReturn {
  const [quality, setQuality] = useState<ConnectionQuality>('unknown')
  const [stats, setStats] = useState<ConnectionStats | null>(null)

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const prevPacketsLostRef = useRef(0)
  const prevPacketsReceivedRef = useRef(0)

  const getStats = useCallback(async () => {
    const pc = peerConnectionRef.current
    if (!pc) return

    try {
      const stats = await pc.getStats()
      let packetsLost = 0
      let packetsReceived = 0
      let roundTripTime = 0
      let bandwidth = 0
      let connectionType = 'unknown'
      let localCandidateType = ''
      let remoteCandidateType = ''
      let inboundBitrate = 0
      let outboundBitrate = 0
      let frameWidth = 0
      let frameHeight = 0
      let framesPerSecond = 0

      stats.forEach((report) => {
        if (report.type === 'inbound-rtp' && report.kind === 'video') {
          packetsLost = report.packetsLost ?? 0
          packetsReceived = report.packetsReceived ?? 0
          frameWidth = report.frameWidth ?? 0
          frameHeight = report.frameHeight ?? 0
          framesPerSecond = report.framesPerSecond ?? 0
          inboundBitrate = report.bytesReceived ? (report.bytesReceived * 8) / 1000 : 0
        }
        if (report.type === 'outbound-rtp' && report.kind === 'video') {
          outboundBitrate = report.bytesSent ? (report.bytesSent * 8) / 1000 : 0
        }
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          roundTripTime = report.currentRoundTripTime ? report.currentRoundTripTime * 1000 : 0
          bandwidth = report.availableOutgoingBitrate ?? 0
        }
        if (report.type === 'local-candidate') {
          localCandidateType = report.candidateType ?? ''
        }
        if (report.type === 'remote-candidate') {
          remoteCandidateType = report.candidateType ?? ''
        }
      })

      // Determine connection type
      if (localCandidateType === 'relay' || remoteCandidateType === 'relay') {
        connectionType = 'TURN relay (slower)'
      } else if (localCandidateType === 'srflx' || remoteCandidateType === 'srflx') {
        connectionType = 'STUN (NAT traversal)'
      } else if (localCandidateType === 'host' && remoteCandidateType === 'host') {
        connectionType = 'Direct P2P (fastest)'
      }

      // Calculate packet loss percentage since last check
      const deltaLost = packetsLost - prevPacketsLostRef.current
      const deltaReceived = packetsReceived - prevPacketsReceivedRef.current
      const totalPackets = deltaLost + deltaReceived
      const packetLossPercent = totalPackets > 0 ? (deltaLost / totalPackets) * 100 : 0

      prevPacketsLostRef.current = packetsLost
      prevPacketsReceivedRef.current = packetsReceived

      const newQuality = calculateQuality(packetLossPercent, roundTripTime)
      const newStats: ConnectionStats = {
        quality: newQuality,
        packetLoss: packetLossPercent,
        roundTripTime,
        bandwidth,
      }

      // Log detailed stats every check
      console.log('[v0] WebRTC Stats:', {
        connectionType,
        quality: newQuality,
        rtt: `${roundTripTime.toFixed(0)}ms`,
        packetLoss: `${packetLossPercent.toFixed(1)}%`,
        bandwidth: `${(bandwidth / 1000000).toFixed(2)} Mbps`,
        receivedVideo: `${frameWidth}x${frameHeight} @ ${framesPerSecond?.toFixed(0) || 0}fps`,
        inboundKbps: (inboundBitrate / 1000).toFixed(0),
        outboundKbps: (outboundBitrate / 1000).toFixed(0),
      })

      setQuality(newQuality)
      setStats(newStats)
    } catch (err) {
      console.error('[useConnectionQuality] Failed to get stats:', err)
    }
  }, [])

  const startMonitoring = useCallback(
    (peerConnection: RTCPeerConnection) => {
      // Stop any existing monitoring
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }

      peerConnectionRef.current = peerConnection
      prevPacketsLostRef.current = 0
      prevPacketsReceivedRef.current = 0

      // Start monitoring
      intervalRef.current = setInterval(getStats, CALL_TIMEOUTS.QUALITY_CHECK_INTERVAL)

      // Get initial stats
      getStats()
    },
    [getStats]
  )

  const stopMonitoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    peerConnectionRef.current = null
    setQuality('unknown')
    setStats(null)
    prevPacketsLostRef.current = 0
    prevPacketsReceivedRef.current = 0
  }, [])

  return {
    quality,
    stats,
    startMonitoring,
    stopMonitoring,
  }
}
