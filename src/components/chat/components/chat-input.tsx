'use client'

import { useState, useCallback, useMemo } from 'react'
import { Send, Paperclip, X, FileIcon, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useFileUpload } from '../hooks/use-file-upload'
import { useTyping } from '../hooks/use-typing'
import type { ChatInputProps } from '../types'

export function ChatInput({
  appointmentId,
  isConnected,
  canSendMessages,
  isCompleted,
  isChatBlocked,
  currentSenderType,
  onSendMessage,
  onStartTyping,
  onStopTyping,
  externalAttachment,
  externalSelectedFile,
  externalIsUploading,
  onRemoveExternalAttachment,
}: ChatInputProps) {
  const [inputValue, setInputValue] = useState('')
  
  const {
    selectedFile: internalSelectedFile,
    uploadedAttachment: internalUploadedAttachment,
    isUploading: internalIsUploading,
    fileInputRef,
    handleFileSelect,
    handleRemoveAttachment: handleRemoveInternalAttachment,
    handlePaste,
    resetAfterSend,
  } = useFileUpload(appointmentId)
  
  const { handleTyping, resetTyping } = useTyping(appointmentId, onStartTyping, onStopTyping)

  // Combine internal and external attachment - external (drag-drop) takes priority
  const { selectedFile, uploadedAttachment, isUploading, handleRemoveAttachment } = useMemo(() => {
    // If there's an external attachment from drag-drop, use it
    if (externalAttachment || externalSelectedFile) {
      return {
        selectedFile: externalSelectedFile ?? null,
        uploadedAttachment: externalAttachment ?? null,
        isUploading: externalIsUploading ?? false,
        handleRemoveAttachment: onRemoveExternalAttachment ?? (() => {}),
      }
    }
    // Otherwise use internal attachment from button click
    return {
      selectedFile: internalSelectedFile,
      uploadedAttachment: internalUploadedAttachment,
      isUploading: internalIsUploading,
      handleRemoveAttachment: handleRemoveInternalAttachment,
    }
  }, [
    externalAttachment, 
    externalSelectedFile, 
    externalIsUploading, 
    onRemoveExternalAttachment, 
    internalSelectedFile, 
    internalUploadedAttachment, 
    internalIsUploading, 
    handleRemoveInternalAttachment
  ])

  const handleSend = useCallback(() => {
    const text = inputValue.trim()
    const hasAttachment = uploadedAttachment !== null
    
    if (!text && !hasAttachment) return
    if (isUploading) return

    onSendMessage(text, uploadedAttachment?.id)
    setInputValue('')
    resetAfterSend()
    // Also clear external attachment if any
    if (externalAttachment && onRemoveExternalAttachment) {
      onRemoveExternalAttachment()
    }
    resetTyping()
  }, [inputValue, uploadedAttachment, isUploading, onSendMessage, resetAfterSend, resetTyping, externalAttachment, onRemoveExternalAttachment])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  return (
    <div className="p-4 border-t border-border bg-card">
      {/* Chat blocked notice for patient - cannot send messages */}
      {isChatBlocked && currentSenderType === 'user' && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 text-green-600 text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Консультация завершена</span>
        </div>
      )}
      
      {/* Attachment preview */}
      {selectedFile && canSendMessages && (
        <div className="mb-3 p-2 bg-muted rounded-lg flex items-center gap-2">
          {uploadedAttachment && uploadedAttachment.mimeType?.startsWith('image/') ? (
            <img 
              src={uploadedAttachment.url} 
              alt={selectedFile.name}
              className="w-12 h-12 object-cover rounded"
            />
          ) : (
            <div className="w-12 h-12 bg-background rounded flex items-center justify-center">
              <FileIcon className="w-6 h-6 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm truncate">{selectedFile.name}</p>
            <p className="text-xs text-muted-foreground">
              {isUploading ? 'Загрузка...' : `${(selectedFile.size / 1024).toFixed(1)} KB`}
            </p>
          </div>
          {isUploading ? (
            <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={handleRemoveAttachment}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}
      
      {canSendMessages ? (
        <div className="flex flex-col gap-2">
          {/* Attach file button - visible */}
          <div className="flex items-center">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileSelect}
              accept="image/*,.pdf,.doc,.docx,.txt"
            />
            
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-muted-foreground hover:text-foreground"
              onClick={() => fileInputRef.current?.click()}
              disabled={!isConnected || isUploading}
            >
              <Paperclip className="w-4 h-4" />
              <span>Прикрепить файл</span>
            </Button>
          </div>
          
          {/* Message input row */}
          <div className="flex items-end gap-2">
            <textarea
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value)
                handleTyping()
              }}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Введите сообщение..."
              className="flex-1 min-h-[40px] max-h-[120px] px-3 py-2 rounded-md border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!isConnected}
              rows={1}
              style={{ height: 'auto' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = 'auto'
                target.style.height = Math.min(target.scrollHeight, 120) + 'px'
              }}
            />
            <Button
              onClick={handleSend}
              disabled={(!inputValue.trim() && !uploadedAttachment) || !isConnected || isUploading}
              size="icon"
              className="shrink-0 mb-0.5"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ) : null}
      {!isConnected && canSendMessages && (
        <p className="text-xs text-destructive mt-2">
          Нет подключения к серверу. Переподключение...
        </p>
      )}
    </div>
  )
}
