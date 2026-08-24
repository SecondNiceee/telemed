'use client'

import { useCallback, useEffect } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useSocket } from '@/components/socket-provider'
import { useChatStore } from '@/stores/chat-store'
import { ChatMessages } from '@/components/chat/components/chat-messages'
import { ChatInput } from '@/components/chat/components/chat-input'
import { DragDropOverlay } from '@/components/chat/components/drag-drop-overlay'
import { useFileUpload } from '@/components/chat/hooks/use-file-upload'

interface CallChatPanelProps {
  appointmentId: number
  currentSenderType: 'user' | 'doctor'
  currentSenderId: number
  otherPartyName: string
  /** Блокировка чата пациента, выставленная врачом (значение с сервера). */
  chatBlocked: boolean
  onClose: () => void
}

/**
 * Чат консультации внутри звонка. Работает с тем же appointmentId, теми же
 * сообщениями и тем же сокетом, что и чат на странице консультации, поэтому
 * переписка и вложения общие - отдельного «звонкового» чата не существует.
 *
 * Комнату сокета джойнит CallRoom (она нужна и при закрытой панели, чтобы
 * считать непрочитанные), здесь только помечаем чат активным и читаем.
 */
export function CallChatPanel({
  appointmentId,
  currentSenderType,
  currentSenderId,
  otherPartyName,
  chatBlocked,
  onClose,
}: CallChatPanelProps) {
  const { sendMessage, markAsRead, startTyping, stopTyping, isConnected, hasConnectionError } = useSocket()
  const messages = useChatStore((state) => state.messages[appointmentId])
  const isLoading = useChatStore((state) => state.loadingMessages[appointmentId] ?? false)
  const isLoadingOlder = useChatStore((state) => state.loadingOlderMessages[appointmentId] ?? false)
  const hasOlderMessages = useChatStore((state) => state.hasOlderMessages[appointmentId] ?? false)
  const typingUser = useChatStore((state) => state.typingUsers[appointmentId])
  const blockedFromSocket = useChatStore((state) => state.chatBlocked[appointmentId])
  const loadMessages = useChatStore((state) => state.loadMessages)
  const loadOlderMessages = useChatStore((state) => state.loadOlderMessages)
  const setActiveChat = useChatStore((state) => state.setActiveChat)

  const {
    isDragging,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    uploadedAttachment,
    selectedFile,
    isUploading,
    handleRemoveAttachment,
  } = useFileUpload(appointmentId)

  const appointmentMessages = messages ?? []
  const isChatBlocked = blockedFromSocket ?? chatBlocked
  // Врач пишет всегда, пациент - если врач не заблокировал чат.
  const canSendMessages = currentSenderType === 'doctor' || !isChatBlocked

  // Панель открыта - чат считается активным: непрочитанные сбрасываются,
  // а глобальный тост о новом сообщении не дублирует то, что уже на экране.
  useEffect(() => {
    setActiveChat(appointmentId)
    void loadMessages(appointmentId)
    return () => setActiveChat(null)
  }, [appointmentId, loadMessages, setActiveChat])

  useEffect(() => {
    if (document.visibilityState === 'visible') markAsRead(appointmentId)
  }, [appointmentId, appointmentMessages.length, markAsRead])

  const handleSendMessage = useCallback(async (text: string, attachmentId?: number) => {
    try {
      await sendMessage(appointmentId, text, attachmentId)
    } catch {
      toast.error('Сообщение не отправлено. Проверьте соединение.', { position: 'top-center' })
    }
  }, [appointmentId, sendMessage])

  const handleLoadOlder = useCallback(async () => {
    await loadOlderMessages(appointmentId)
  }, [appointmentId, loadOlderMessages])

  const handleStartTyping = useCallback(() => startTyping(appointmentId), [appointmentId, startTyping])
  const handleStopTyping = useCallback(() => stopTyping(appointmentId), [appointmentId, stopTyping])

  return (
    <aside
      className="relative flex size-full min-h-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-lg"
      aria-label="Чат консультации"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <DragDropOverlay isVisible={isDragging} />

      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex min-w-0 flex-col">
          <h2 className="truncate text-sm font-semibold text-foreground">Чат консультации</h2>
          <p className="truncate text-xs text-muted-foreground">{otherPartyName}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Скрыть чат">
          <X />
        </Button>
      </header>

      <ChatMessages
        appointmentId={appointmentId}
        messages={appointmentMessages}
        currentSenderType={currentSenderType}
        currentSenderId={currentSenderId}
        otherPartyName={otherPartyName}
        isLoading={isLoading}
        isLoadingOlder={isLoadingOlder}
        hasOlderMessages={hasOlderMessages}
        onLoadOlder={handleLoadOlder}
        typingUser={typingUser}
      />

      <ChatInput
        appointmentId={appointmentId}
        isConnected={isConnected}
        hasConnectionError={hasConnectionError}
        canSendMessages={canSendMessages}
        isCancelled={false}
        isChatBlocked={isChatBlocked}
        currentSenderType={currentSenderType}
        onSendMessage={handleSendMessage}
        onStartTyping={handleStartTyping}
        onStopTyping={handleStopTyping}
        externalAttachment={uploadedAttachment}
        externalSelectedFile={selectedFile}
        externalIsUploading={isUploading}
        onRemoveExternalAttachment={handleRemoveAttachment}
      />
    </aside>
  )
}
