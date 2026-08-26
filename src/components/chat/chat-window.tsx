'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSocket } from '@/components/socket-provider'
import { useChatStore } from '@/stores/chat-store'
import { useFeedbackStore } from '@/stores/feedback-store'
import { getCountdownParts } from '@/lib/utils/date'
import { getBaseUrl } from '@/lib/api/fetch'
import { AppointmentsApi } from '@/lib/api/appointments'
import { readFailedMessages, writeFailedMessages, type FailedChatMessage } from '@/lib/chat/failed-messages'
import { ShieldOff } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import { ChatHeader } from './components/chat-header'
import { ChatMessages } from './components/chat-messages'
import { ChatInput } from './components/chat-input'
import { VideoSaveSidebar } from './components/video-save-sidebar'
import { ConsultationDialogs } from './components/consultation-dialogs'
import { DragDropOverlay } from './components/drag-drop-overlay'
import { FeedbackDialog } from '@/components/feedback-dialog'
import { useFileUpload } from './hooks/use-file-upload'

import type { ChatWindowProps, VideoSaveStatus, ConsultationType } from './types'

export function ChatWindow({
  appointment,
  currentSenderType,
  currentSenderId,
  onBack,
  onAppointmentCompleted,
}: ChatWindowProps) {
  // UI State
  const [countdownParts, setCountdownParts] = useState(() => 
    getCountdownParts(appointment.date, appointment.time)
  )
  const [showCompleteDialog, setShowCompleteDialog] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [cancellationReason, setCancellationReason] = useState('')
  const [customCancellationReason, setCustomCancellationReason] = useState('')
  const [localStatus, setLocalStatus] = useState(appointment.status)
  const [showConsultationTypeDialog, setShowConsultationTypeDialog] = useState(false)
  const [consultationType, setConsultationType] = useState<ConsultationType>(null)
  const [isTabVisible, setIsTabVisible] = useState(true)
  const [failedMessages, setFailedMessages] = useState<FailedChatMessage[]>([])
  const [retryingMessageIds, setRetryingMessageIds] = useState<Set<string>>(new Set())
  
  // Video saving state
  const [isSavingVideo, setIsSavingVideo] = useState(false)
  const [videoSaveProgress, setVideoSaveProgress] = useState(0)
  const [videoSaveStatus, setVideoSaveStatus] = useState<VideoSaveStatus>(null)
  
  // Feedback state
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false)

  // Hooks
  const router = useRouter()
  const { sendMessage, joinRoom, leaveRoom, markAsRead, startTyping, stopTyping, isConnected, hasConnectionError, initiateCall, startConsultation, endConsultation, cancelConsultation, blockChat, unblockChat, changeConnectionType } = useSocket()
  const { messages, loadMessages, loadOlderMessages, loadingMessages, loadingOlderMessages, hasOlderMessages, typingUsers, setActiveChat, appointmentStatuses, chatBlocked, connectionTypes } = useChatStore()
  const { feedbackExistsByAppointment, checkFeedbackExists, setFeedbackExists } = useFeedbackStore()
  const { 
    isDragging, 
    handleDragOver, 
    handleDragLeave, 
    handleDrop, 
    clearAttachment,
    uploadedAttachment: dragDropAttachment,
    selectedFile: dragDropSelectedFile,
    isUploading: dragDropIsUploading,
    handleRemoveAttachment: handleRemoveDragDropAttachment,
  } = useFileUpload(appointment.id)

  // Derived state
  const appointmentMessages = messages[appointment.id] || []
  const deliveredClientMessageIds = new Set(appointmentMessages.map((message) => message.clientMessageId).filter(Boolean))
  const visibleFailedMessages = failedMessages.filter((message) => !deliveredClientMessageIds.has(message.clientMessageId))
  const displayedMessages = [
    ...appointmentMessages,
    ...visibleFailedMessages.map((message) => ({
      id: message.localId,
      clientMessageId: message.clientMessageId,
      appointment: message.appointmentId,
      text: message.text,
      attachment: message.attachmentId,
      sender: {
        relationTo: message.senderType === 'user' ? 'users' as const : 'doctors' as const,
        value: message.senderId,
      },
      createdAt: message.createdAt,
      read: false,
      deliveryStatus: retryingMessageIds.has(message.localId) ? 'retrying' as const : 'failed' as const,
    })),
  ].sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime())
  const isLoading = loadingMessages[appointment.id]
  const typingUser = typingUsers[appointment.id]
  // Use socket-updated status if available, otherwise use local/prop status
  const socketStatus = appointmentStatuses[appointment.id]
  const effectiveStatus = socketStatus || localStatus
  const isCompleted = effectiveStatus === 'completed'
  const isCancelled = effectiveStatus === 'cancelled'
  const isChatBlocked = chatBlocked[appointment.id] ?? appointment.chatBlocked === true
  // A cancelled consultation is read-only for both participants.
  // Otherwise doctors can always send, while patients respect the chat block.
  const canSendMessages = !isCancelled && (currentSenderType === 'doctor' || !isChatBlocked)
  // Use socket-updated connection type if available, otherwise use appointment prop
  const effectiveConnectionType = connectionTypes[appointment.id] || appointment.connectionType || 'chat'
  
  const otherPartyName = currentSenderType === 'user' 
    ? appointment.doctorName || 'Врач'
    : appointment.userName || 'Пациент'

  useEffect(() => {
    setFailedMessages(readFailedMessages(currentSenderType, currentSenderId, appointment.id))
  }, [appointment.id, currentSenderId, currentSenderType])

  const persistFailedMessages = useCallback((nextMessages: FailedChatMessage[]) => {
    setFailedMessages(nextMessages)
    writeFailedMessages(currentSenderType, currentSenderId, appointment.id, nextMessages)
  }, [appointment.id, currentSenderId, currentSenderType])

  // Update countdown every second
  useEffect(() => {
    setCountdownParts(getCountdownParts(appointment.date, appointment.time))
    const timer = setInterval(() => {
      setCountdownParts(getCountdownParts(appointment.date, appointment.time))
    }, 1000)
    return () => clearInterval(timer)
  }, [appointment.date, appointment.time])

  // Sync local status when appointment or socket status changes
  useEffect(() => {
    if (socketStatus) {
      setLocalStatus(socketStatus as typeof appointment.status)
    } else {
      setLocalStatus(appointment.status)
    }
  }, [appointment.status, socketStatus])

  // Track tab visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabVisible(document.visibilityState === 'visible')
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // Join room and load messages on mount
  useEffect(() => {
    setActiveChat(appointment.id)
    joinRoom(appointment.id)
    loadMessages(appointment.id)
    return () => {
      leaveRoom(appointment.id)
      setActiveChat(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointment.id])
  
  // Mark as read when chat opens and tab is visible
  useEffect(() => {
    if (isTabVisible) {
      markAsRead(appointment.id)
    }
  }, [appointment.id, isTabVisible, markAsRead])

  // Mark as read when new messages arrive - ONLY if tab is visible
  useEffect(() => {
    if (appointmentMessages.length > 0 && isTabVisible) {
      markAsRead(appointment.id)
    }
  }, [appointmentMessages.length, appointment.id, markAsRead, isTabVisible])

  // Mark as read when tab becomes visible
  useEffect(() => {
    if (isTabVisible && appointmentMessages.length > 0) {
      markAsRead(appointment.id)
    }
  }, [isTabVisible, appointmentMessages.length, appointment.id, markAsRead])

  // Clear attachment when appointment changes
  useEffect(() => {
    clearAttachment()
  }, [appointment.id, clearAttachment])

  // Check if feedback exists for this appointment (only for completed consultations and patients)
  useEffect(() => {
    if (currentSenderType === 'user' && (isCompleted || appointment.status === 'completed')) {
      checkFeedbackExists(appointment.id)
    }
  }, [appointment.id, appointment.status, isCompleted, currentSenderType, checkFeedbackExists])

  // Handlers
  const handleCompleteAppointment = async () => {
    setIsCompleting(true)
    try {
      // Use socket to end consultation (real-time update for all participants)
      endConsultation(appointment.id)
      setLocalStatus('completed')
      setShowCompleteDialog(false)
      onAppointmentCompleted?.(appointment.id)
    } catch (error) {
      console.error('Failed to complete appointment:', error)
      toast.error('Не удалось завершить консультацию')
    } finally {
      setIsCompleting(false)
    }
  }

  const handleCancelAppointment = async () => {
    setIsCancelling(true)
    try {
      const response = await fetch(`/api/appointments/${appointment.id}/cancel`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reasonType: cancellationReason,
          customReason: customCancellationReason,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Не удалось отменить консультацию')
      cancelConsultation(appointment.id)
      setLocalStatus('cancelled')
      setShowCancelDialog(false)
      toast.success('Консультация отмечена как несостоявшаяся')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось отменить консультацию')
    } finally {
      setIsCancelling(false)
    }
  }

  const handleToggleChatBlock = () => {
    if (isChatBlocked) {
      unblockChat(appointment.id)
      toast.success('Пациент может писать сообщения')
    } else {
      blockChat(appointment.id)
      toast.success('Пациент больше не может писать сообщения')
    }
  }

  const handleFeedbackSuccess = () => {
    setFeedbackExists(appointment.id, true)
    setShowFeedbackDialog(false)
  }

  const handleChangeConnectionType = (newConnectionType: 'chat' | 'audio' | 'video') => {
    if (currentSenderType === 'user' && newConnectionType !== effectiveConnectionType) {
      changeConnectionType(appointment.id, newConnectionType)
    }
  }

  // Get doctor info for feedback dialog
  const doctorId = typeof appointment.doctor === 'object' ? appointment.doctor.id : appointment.doctor
  const doctorName = appointment.doctorName || (typeof appointment.doctor === 'object' ? appointment.doctor.name : null) || 'Врач'
  const hasFeedback = feedbackExistsByAppointment[appointment.id] === true

  const handleStartConsultationClick = () => {
    setShowConsultationTypeDialog(true)
  }

  const checkMediaPermissions = async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      stream.getTracks().forEach(track => track.stop())
      return true
    } catch (error) {
      const err = error as DOMException
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        toast.error('Выдайте доступ к микрофону и камере для видеозвонка')
      } else if (err.name === 'NotFoundError') {
        toast.error('Камера или микрофон не найдены на устройстве')
      } else {
        toast.error('Не удалось получить доступ к камере и микрофону')
      }
      return false
    }
  }

  const checkAudioPermissions = async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(track => track.stop())
      return true
    } catch (error) {
      const err = error as DOMException
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        toast.error('Выдайте доступ к микрофону для аудиозвонка')
      } else if (err.name === 'NotFoundError') {
        toast.error('Микрофон не найден на устройстве')
      } else {
        toast.error('Не удалось получить доступ к микрофону')
      }
      return false
    }
  }

  const handleStartVideoConsultation = async () => {
    const hasPermissions = await checkMediaPermissions()
    if (!hasPermissions) return
    
    setShowConsultationTypeDialog(false)
    setConsultationType('video')
    setLocalStatus('in_progress')
    
    // Use socket to start consultation (real-time update for all participants)
    startConsultation(appointment.id)
    
    const callId = initiateCall(appointment.id, '', currentSenderType === 'doctor' ? appointment.doctorName || 'Врач' : appointment.userName || 'Пациент', false)
    if (!callId) {
      toast.error('Не удалось начать звонок: нет подключения к серверу')
      return
    }
    router.push(`/appointment/${appointment.id}/call?caller=1&callId=${encodeURIComponent(callId)}`)
  }

  const handleStartAudioConsultation = async () => {
    const hasPermissions = await checkAudioPermissions()
    if (!hasPermissions) return
    
    setShowConsultationTypeDialog(false)
    setConsultationType('video') // Reuse video state for audio call UI
    setLocalStatus('in_progress')
    
    // Use socket to start consultation (real-time update for all participants)
    startConsultation(appointment.id)
    
    const callId = initiateCall(appointment.id, '', currentSenderType === 'doctor' ? appointment.doctorName || 'Врач' : appointment.userName || 'Пациент', true)
    if (!callId) {
      toast.error('Не удалось начать звонок: нет подключения к серверу')
      return
    }
    router.push(`/appointment/${appointment.id}/call?audio=1&caller=1&callId=${encodeURIComponent(callId)}`)
  }

  const handleStartChatConsultation = async () => {
    setShowConsultationTypeDialog(false)
    setConsultationType('chat')
    setLocalStatus('in_progress')
    
    // Use socket to start consultation (real-time update for all participants)
    startConsultation(appointment.id)
    toast.success('Консультация начата в чате')
  }

  const handleSendMessage = useCallback(async (text: string, attachmentId?: number) => {
    const clientMessageId = crypto.randomUUID()
    try {
      await sendMessage(appointment.id, text, attachmentId, clientMessageId)
    } catch {
      const failedMessage: FailedChatMessage = {
        localId: `failed-${clientMessageId}`,
        clientMessageId,
        appointmentId: appointment.id,
        senderType: currentSenderType,
        senderId: currentSenderId,
        text,
        attachmentId,
        createdAt: new Date().toISOString(),
      }
      setFailedMessages((current) => {
        const nextMessages = [...current, failedMessage]
        writeFailedMessages(currentSenderType, currentSenderId, appointment.id, nextMessages)
        return nextMessages
      })
    }
  }, [appointment.id, currentSenderId, currentSenderType, sendMessage])

  const handleRetryMessage = useCallback(async (localId: string) => {
    const failedMessage = failedMessages.find((message) => message.localId === localId)
    if (!failedMessage || retryingMessageIds.has(localId)) return

    setRetryingMessageIds((current) => new Set(current).add(localId))
    try {
      await sendMessage(appointment.id, failedMessage.text, failedMessage.attachmentId, failedMessage.clientMessageId)
      persistFailedMessages(failedMessages.filter((message) => message.localId !== localId))
    } catch {
      // Keep the message in the retry queue. The failed state is already visible in the bubble.
    } finally {
      setRetryingMessageIds((current) => {
        const next = new Set(current)
        next.delete(localId)
        return next
      })
    }
  }, [appointment.id, failedMessages, persistFailedMessages, retryingMessageIds, sendMessage])

  const handleStartTyping = useCallback(() => {
    startTyping(appointment.id)
  }, [appointment.id, startTyping])

  const handleStopTyping = useCallback(() => {
    stopTyping(appointment.id)
  }, [appointment.id, stopTyping])

  // Handle consultation complete from VideoCall (with recording)
  const handleConsultationComplete = useCallback(async (recordingBlob: Blob | null) => {
    if (recordingBlob && recordingBlob.size > 0) {
      setIsSavingVideo(true)
      setVideoSaveProgress(0)
      setVideoSaveStatus('uploading')
      
      try {
        const formData = new FormData()
        formData.append('file', recordingBlob, `consultation-${appointment.id}-${Date.now()}.webm`)
        formData.append('alt', `Запись консультации #${appointment.id}`)
        
        const uploadPromise = new Promise<{ ok: boolean; data?: { doc?: { id: number } } }>((resolve) => {
          const xhr = new XMLHttpRequest()
          
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              const percent = Math.round((e.loaded / e.total) * 100)
              setVideoSaveProgress(percent)
            }
          })
          
          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const data = JSON.parse(xhr.responseText)
                resolve({ ok: true, data })
              } catch {
                resolve({ ok: false })
              }
            } else {
              resolve({ ok: false })
            }
          })
          
          xhr.addEventListener('error', () => {
            resolve({ ok: false })
          })
          
          xhr.open('POST', `${getBaseUrl()}/api/media`)
          xhr.withCredentials = true
          xhr.send(formData)
        })
        
        const uploadResult = await uploadPromise
        
        if (uploadResult.ok) {
          setVideoSaveStatus('processing')
          const mediaId = uploadResult.data?.doc?.id
          
          if (mediaId) {
            setVideoSaveStatus('saving')
            await fetch(`${getBaseUrl()}/api/appointments/${appointment.id}`, {
              method: 'PATCH',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ recording: mediaId }),
            })
          }
          
          setVideoSaveStatus('done')
          toast.success('Запись консультации сохранена')
        } else {
          setVideoSaveStatus('error')
          toast.error('Не удалось сохранить запись')
        }
      } catch (error) {
        console.error('[ChatWindow] Failed to upload recording:', error)
        setVideoSaveStatus('error')
        toast.error('Ошибка при сохранении записи')
      } finally {
        setTimeout(() => {
          setIsSavingVideo(false)
          setVideoSaveStatus(null)
        }, 2000)
      }
    }
    
    try {
      await AppointmentsApi.complete(appointment.id)
      setLocalStatus('completed')
      onAppointmentCompleted?.(appointment.id)
      toast.success('Консультация ��авершена')
    } catch (error) {
      console.error('[ChatWindow] Failed to complete appointment:', error)
      toast.error('Не удалось завершить консультацию')
    }
  }, [appointment.id, onAppointmentCompleted])

  return (
    <div 
      className={cn(
        "flex flex-col h-full bg-background relative",
        isDragging && "ring-2 ring-primary ring-inset"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <DragDropOverlay isVisible={isDragging} />
      
      <VideoSaveSidebar 
        isVisible={isSavingVideo}
        progress={videoSaveProgress}
        status={videoSaveStatus}
      />
      
<ChatHeader
  appointment={appointment}
  currentSenderType={currentSenderType}
  currentSenderId={currentSenderId}
  otherPartyName={otherPartyName}
  localStatus={localStatus}
  isCompleted={isCompleted}
  isConnected={isConnected}
  consultationType={consultationType}
  countdownParts={countdownParts}
        videoCallStatus="idle"
  isChatBlocked={isChatBlocked}
  hasFeedback={hasFeedback}
  connectionType={effectiveConnectionType}
  onBack={onBack}
  onStartConsultation={handleStartConsultationClick}
  onStartVideoCall={handleStartVideoConsultation}
  onStartAudioCall={handleStartAudioConsultation}
        onShowCompleteDialog={() => setShowCompleteDialog(true)}
        onShowCancelDialog={() => setShowCancelDialog(true)}
        onToggleChatBlock={handleToggleChatBlock}
  onLeaveFeedback={() => setShowFeedbackDialog(true)}
  onChangeConnectionType={handleChangeConnectionType}
  />
      
      <ConsultationDialogs
        showCompleteDialog={showCompleteDialog}
        showConsultationTypeDialog={showConsultationTypeDialog}
        showCancelDialog={showCancelDialog}
        isCompleting={isCompleting}
        isCancelling={isCancelling}
        cancellationReason={cancellationReason}
        customCancellationReason={customCancellationReason}
        connectionType={effectiveConnectionType}
        onCompleteDialogChange={setShowCompleteDialog}
        onConsultationTypeDialogChange={setShowConsultationTypeDialog}
        onCancelDialogChange={setShowCancelDialog}
        onCancellationReasonChange={setCancellationReason}
        onCustomCancellationReasonChange={setCustomCancellationReason}
        onComplete={handleCompleteAppointment}
        onCancel={handleCancelAppointment}
        onStartVideoConsultation={handleStartVideoConsultation}
        onStartAudioConsultation={handleStartAudioConsultation}
        onStartChatConsultation={handleStartChatConsultation}
      />

      {/* VPN уводит трафик через лишний узел и портит связь в звонке. Подсказка
          нужна до начала консультации, поэтому в завершённой и отменённой её
          не показываем - там она уже ни на что не влияет. */}
      {!isCompleted && !isCancelled && (
        <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2">
          <ShieldOff className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
            Для лучшей связи рекомендуется выключить VPN
          </p>
        </div>
      )}

      <ChatMessages
        appointmentId={appointment.id}
        messages={displayedMessages}
        currentSenderType={currentSenderType}
        currentSenderId={currentSenderId}
        otherPartyName={otherPartyName}
        isLoading={isLoading}
        isLoadingOlder={loadingOlderMessages[appointment.id] ?? false}
        hasOlderMessages={hasOlderMessages[appointment.id] ?? false}
        onLoadOlder={() => loadOlderMessages(appointment.id)}
        typingUser={typingUser}
        recording={appointment.recording as { url?: string } | null}
        onRetryMessage={(localId) => void handleRetryMessage(localId)}
      />

<ChatInput
  appointmentId={appointment.id}
  isConnected={isConnected}
  hasConnectionError={hasConnectionError}
  canSendMessages={canSendMessages}
  isCancelled={isCancelled}
  isChatBlocked={isChatBlocked}
  currentSenderType={currentSenderType}
  onSendMessage={handleSendMessage}
  onStartTyping={handleStartTyping}
  onStopTyping={handleStopTyping}
  externalAttachment={dragDropAttachment}
  externalSelectedFile={dragDropSelectedFile}
  externalIsUploading={dragDropIsUploading}
  onRemoveExternalAttachment={handleRemoveDragDropAttachment}
  />
  
  {/* Feedback Dialog for patient */}
  {currentSenderType === 'user' && (
    <FeedbackDialog
      open={showFeedbackDialog}
      onOpenChange={setShowFeedbackDialog}
      doctorName={doctorName}
      doctorId={doctorId}
      appointmentId={appointment.id}
      userId={currentSenderId}
      onSuccess={handleFeedbackSuccess}
    />
  )}
  </div>
  )
  }
