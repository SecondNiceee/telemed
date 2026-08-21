export interface FailedChatMessage {
  localId: string
  clientMessageId: string
  appointmentId: number
  senderType: 'user' | 'doctor'
  senderId: number
  text: string
  attachmentId?: number
  createdAt: string
}

const storagePrefix = 'telemed:failed-messages'

function getStorageKey(senderType: 'user' | 'doctor', senderId: number, appointmentId: number): string {
  return `${storagePrefix}:${senderType}:${senderId}:${appointmentId}`
}

export function readFailedMessages(senderType: 'user' | 'doctor', senderId: number, appointmentId: number): FailedChatMessage[] {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(getStorageKey(senderType, senderId, appointmentId)) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.map((message) => ({
      ...message,
      clientMessageId: message.clientMessageId || message.localId || crypto.randomUUID(),
    }))
  } catch {
    return []
  }
}

export function writeFailedMessages(senderType: 'user' | 'doctor', senderId: number, appointmentId: number, messages: FailedChatMessage[]): void {
  if (typeof window === 'undefined') return
  const key = getStorageKey(senderType, senderId, appointmentId)
  if (messages.length === 0) window.localStorage.removeItem(key)
  else window.localStorage.setItem(key, JSON.stringify(messages))
}
