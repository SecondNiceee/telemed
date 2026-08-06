'use client'

import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { CallControlsProps } from '@/lib/video-call/types'

interface ExtendedCallControlsProps extends CallControlsProps {
  isAudioOnly?: boolean
}

export function CallControls({
  isVideoEnabled,
  isAudioEnabled,
  isCameraAvailable,
  isMicrophoneAvailable,
  onToggleVideo,
  onToggleAudio,
  onEndCall,
  onToggleMinimize,
  isMinimized,
  isAudioOnly,
}: ExtendedCallControlsProps) {
  return (
    <div className="flex items-center justify-center gap-3">
      {/* Audio toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isAudioEnabled ? 'secondary' : 'destructive'}
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={onToggleAudio}
            disabled={!isMicrophoneAvailable}
          >
            {isAudioEnabled ? (
              <Mic className="h-5 w-5" />
            ) : (
              <MicOff className="h-5 w-5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {!isMicrophoneAvailable
            ? 'Микрофон недоступен'
            : isAudioEnabled
              ? 'Выключить микрофон'
              : 'Включить микрофон'}
        </TooltipContent>
      </Tooltip>

      {/* Video toggle - hidden for audio-only calls */}
      {!isAudioOnly && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isVideoEnabled ? 'secondary' : 'destructive'}
              size="icon"
              className="h-12 w-12 rounded-full"
              onClick={onToggleVideo}
              disabled={!isCameraAvailable}
            >
              {isVideoEnabled ? (
                <Video className="h-5 w-5" />
              ) : (
                <VideoOff className="h-5 w-5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {!isCameraAvailable
              ? 'Камера недоступна'
              : isVideoEnabled
                ? 'Выключить камеру'
                : 'Включить камеру'}
          </TooltipContent>
        </Tooltip>
      )}

      {/* End call */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="destructive"
            size="icon"
            className="h-14 w-14 rounded-full"
            onClick={onEndCall}
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Завершить звонок</TooltipContent>
      </Tooltip>

      {/* Minimize/Maximize toggle */}
      {onToggleMinimize && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              className="h-12 w-12 rounded-full"
              onClick={onToggleMinimize}
            >
              {isMinimized ? (
                <Maximize2 className="h-5 w-5" />
              ) : (
                <Minimize2 className="h-5 w-5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isMinimized ? 'Развернуть' : 'Свернуть'}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
