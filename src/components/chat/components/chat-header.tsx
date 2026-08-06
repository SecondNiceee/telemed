'use client'

import { ArrowLeft, Video, CheckCircle2, Ban, MessageCircle, Star, Phone, MessageSquare, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { formatCountdown } from '@/lib/utils/date'
import type { ChatHeaderProps } from '../types'

const connectionTypeLabels: Record<string, { label: string; icon: React.ReactNode }> = {
  chat: { label: 'Чат', icon: <MessageSquare className="w-3.5 h-3.5" /> },
  audio: { label: 'Аудио', icon: <Phone className="w-3.5 h-3.5" /> },
  video: { label: 'Видео', icon: <Video className="w-3.5 h-3.5" /> },
}

export function ChatHeader({
  appointment,
  currentSenderType,
  currentSenderId,
  otherPartyName,
  localStatus,
  isCompleted,
  isConnected,
  consultationType,
  countdownParts,
  videoCallStatus,
  isChatBlocked,
  hasFeedback,
  connectionType,
  onBack,
  onStartConsultation,
  onStartVideoCall,
  onStartAudioCall,
  onShowCompleteDialog,
  onToggleChatBlock,
  onLeaveFeedback,
  onChangeConnectionType,
}: ChatHeaderProps) {
  const currentConnectionType = connectionType || appointment.connectionType || 'chat'
  const connectionInfo = connectionTypeLabels[currentConnectionType]
  return (
    <div className="flex flex-col border-b border-border bg-card">
      {/* Countdown banner - prominent (only show before consultation starts) */}
      {countdownParts && !isCompleted && localStatus !== 'in_progress' && (
        <div className="px-5 py-4 bg-green-50 border-b border-green-200">
          <div className="flex items-center gap-2 mb-1">
            {appointment.specialty && (
              <span className="text-sm font-medium text-green-800">{appointment.specialty}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
            </span>
            <span className="text-base font-semibold text-green-800">
              Консультация начнется через{' '}
              <span className="font-bold font-mono tabular-nums">{formatCountdown(countdownParts)}</span>
            </span>
          </div>
        </div>
      )}
      
      {/* In progress banner */}
      {localStatus === 'in_progress' && !isCompleted && (
        <div className="px-5 py-4 bg-blue-50 border-b border-blue-200">
          {appointment.specialty && (
            <span className="text-sm font-medium text-blue-800 block mb-1">{appointment.specialty}</span>
          )}
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
            </span>
            <span className="text-base font-semibold text-blue-800">
              Консультация в процессе
              {consultationType === 'chat' && ' (чат)'}
              {consultationType === 'video' && ' (видео)'}
            </span>
          </div>
        </div>
      )}
      
      {/* Completed banner */}
      {isCompleted && (
        <div className="px-5 py-4 bg-muted border-b border-border">
          {appointment.specialty && (
            <span className="text-sm font-medium text-muted-foreground block mb-1">{appointment.specialty}</span>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-base font-semibold text-muted-foreground">Консультация завершена</span>
            </div>
            {/* Feedback button for patient when consultation is completed and no feedback exists */}
            {currentSenderType === 'user' && !hasFeedback && onLeaveFeedback && (
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 text-xs gap-1.5 border-yellow-500 text-yellow-600 hover:bg-yellow-50 hover:text-yellow-700"
                onClick={onLeaveFeedback}
              >
                <Star className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Оставьте отзыв о враче</span>
                <span className="sm:hidden">Отзыв</span>
              </Button>
            )}
          </div>
        </div>
      )}
      
      {/* Main header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 md:hidden"
            onClick={onBack}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-foreground truncate">{otherPartyName}</h2>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{appointment.date}, {appointment.time}</span>
            <span className="text-muted-foreground/50">|</span>
            {/* Connection type display/selector */}
            {currentSenderType === 'user' && onChangeConnectionType ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1 hover:text-foreground transition-colors">
                    {connectionInfo.icon}
                    <span>{connectionInfo.label}</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {Object.entries(connectionTypeLabels).map(([type, { label, icon }]) => (
                    <DropdownMenuItem
                      key={type}
                      onClick={() => onChangeConnectionType(type as 'chat' | 'audio' | 'video')}
                      className={cn(
                        "flex items-center gap-2",
                        currentConnectionType === type && "bg-accent"
                      )}
                    >
                      {icon}
                      <span>{label}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <span className="flex items-center gap-1">
                {connectionInfo.icon}
                <span>{connectionInfo.label}</span>
              </span>
            )}
          </div>
        </div>
        
        {/* Complete button for doctor - show when consultation is in progress */}
        {currentSenderType === 'doctor' && !isCompleted && localStatus === 'in_progress' && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 text-xs gap-1.5"
            onClick={onShowCompleteDialog}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Завершить консультацию</span>
          </Button>
        )}
        
        {/* Start consultation button - only for doctor when not started */}
        {currentSenderType === 'doctor' && !isCompleted && localStatus !== 'in_progress' && (
          <Button
            variant="default"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={onStartConsultation}
            disabled={!isConnected}
          >
            <Video className="w-4 h-4" />
            <span className="hidden sm:inline">Начать консультацию</span>
          </Button>
        )}
        
        {/* Call button with dropdown - for doctor when consultation is in progress */}
        {currentSenderType === 'doctor' && !isCompleted && localStatus === 'in_progress' && videoCallStatus === 'idle' && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="default"
                size="sm"
                className="shrink-0 gap-1.5"
                disabled={!isConnected}
              >
                <Phone className="w-4 h-4" />
                <span className="hidden sm:inline">Звонок</span>
                <ChevronDown className="w-3 h-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onStartVideoCall} className="flex items-center gap-2">
                <Video className="w-4 h-4" />
                <span>Видео</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onStartAudioCall} className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                <span>Аудио</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        
        {/* Toggle chat block button - for doctor after consultation is completed */}
        {currentSenderType === 'doctor' && isCompleted && (
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "shrink-0 text-xs gap-1.5",
              isChatBlocked 
                ? "text-green-600 border-green-600 hover:bg-green-600 hover:text-white"
                : "text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
            )}
            onClick={onToggleChatBlock}
            disabled={!isConnected}
            title={!isChatBlocked ? "Пациент больше не сможет отправлять вам сообщения" : undefined}
          >
            {isChatBlocked ? (
              <>
                <MessageCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Продолжить диалог</span>
              </>
            ) : (
              <>
                <Ban className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Завершить диалог</span>
              </>
            )}
          </Button>
        )}
        <div className={cn(
          'w-2 h-2 rounded-full shrink-0',
          isConnected ? 'bg-green-500' : 'bg-muted-foreground'
        )} />
      </div>
    </div>
  )
}
