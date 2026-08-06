'use client'

/**
 * VideoCallProviderWrapper
 * 
 * Обертка для выбора между PeerJS и MediaSoup провайдерами.
 * Используйте env переменную NEXT_PUBLIC_USE_MEDIASOUP=true для включения MediaSoup.
 */

import type { ReactNode } from 'react'
import { VideoCallProvider, useVideoCall as usePeerJSVideoCall, useVideoCallSafe as usePeerJSVideoCallSafe } from './video-call-provider'
import { VideoCallProviderMediaSoup, useVideoCallMediaSoup, useVideoCallMediaSoupSafe } from './video-call-provider-mediasoup'

interface VideoCallProviderWrapperProps {
  children: ReactNode
}

// Feature flag для включения MediaSoup
export const USE_MEDIASOUP = process.env.NEXT_PUBLIC_USE_MEDIASOUP === 'true'

export function VideoCallProviderWrapper({ children }: VideoCallProviderWrapperProps) {
  if (USE_MEDIASOUP) {
    return (
      <VideoCallProviderMediaSoup>
        {children}
      </VideoCallProviderMediaSoup>
    )
  }
  
  return (
    <VideoCallProvider>
      {children}
    </VideoCallProvider>
  )
}

// Universal hooks - выбор происходит на уровне модуля, не внутри функции
// Это не нарушает правила React hooks, т.к. USE_MEDIASOUP - константа времени сборки
export const useVideoCall = USE_MEDIASOUP ? useVideoCallMediaSoup : usePeerJSVideoCall
export const useVideoCallSafe = USE_MEDIASOUP ? useVideoCallMediaSoupSafe : usePeerJSVideoCallSafe
