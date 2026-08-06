import { create } from 'zustand'
import { MessagesApi, type ApiMessage, getSenderType } from '@/lib/api/messages'

interface ChatState {
  // Active chat state
  activeAppointmentId: number | null
  
  // Messages by appointment ID
  messages: Record<number, ApiMessage[]>
  
  // Unread counts by appointment ID
  unreadCounts: Record<number, number>
  
  // Loading state per appointment
  loadingMessages: Record<number, boolean>
  
  // Typing indicator state (senderType для совместимости с socket events)
  typingUsers: Record<number, { senderType: 'user' | 'doctor'; senderId: number } | null>
  
  // Appointment statuses (updated via socket)
  appointmentStatuses: Record<number, string>
  
  // Chat blocked state (updated via socket)
  chatBlocked: Record<number, boolean>
  
  // Connection type state (updated via socket)
  connectionTypes: Record<number, 'chat' | 'audio' | 'video'>

  // Actions
  setActiveChat: (appointmentId: number | null) => void
  
  addMessage: (message: ApiMessage) => void
  
  setMessages: (appointmentId: number, messages: ApiMessage[]) => void
  
  loadMessages: (appointmentId: number, forceRefresh?: boolean) => Promise<void>
  
  markAsRead: (appointmentId: number) => void
  
  markMessagesAsReadByType: (appointmentId: number, senderType: 'user' | 'doctor') => void
  
  setUnreadCount: (appointmentId: number, count: number) => void
  
  incrementUnreadCount: (appointmentId: number) => void
  
  setTypingUser: (appointmentId: number, typingUser: { senderType: 'user' | 'doctor'; senderId: number } | null) => void
  
  updateAppointmentStatus: (appointmentId: number, status: string) => void
  
  setChatBlocked: (appointmentId: number, blocked: boolean) => void
  
  setConnectionType: (appointmentId: number, connectionType: 'chat' | 'audio' | 'video') => void
  
  reset: () => void
}

const initialState = {
  activeAppointmentId: null,
  messages: {} as Record<number, ApiMessage[]>,
  unreadCounts: {} as Record<number, number>,
  loadingMessages: {} as Record<number, boolean>,
  typingUsers: {} as Record<number, { senderType: 'user' | 'doctor'; senderId: number } | null>,
  appointmentStatuses: {} as Record<number, string>,
  chatBlocked: {} as Record<number, boolean>,
  connectionTypes: {} as Record<number, 'chat' | 'audio' | 'video'>,
}

export const useChatStore = create<ChatState>((set, get) => ({
  ...initialState,

  setActiveChat: (appointmentId) => {
    set({ activeAppointmentId: appointmentId })
    
    // Reset unread count when opening chat
    if (appointmentId !== null) {
      set((state) => ({
        unreadCounts: {
          ...state.unreadCounts,
          [appointmentId]: 0,
        },
      }))
    }
  },

  addMessage: (message) => {
    const appointmentId = typeof message.appointment === 'object' 
      ? message.appointment.id 
      : message.appointment

    set((state) => {
      const currentMessages = state.messages[appointmentId] || []
      
      // Check if message already exists (prevent duplicates)
      if (currentMessages.some((m) => m.id === message.id)) {
        return state
      }

      return {
        messages: {
          ...state.messages,
          [appointmentId]: [...currentMessages, message],
        },
      }
    })
  },

  setMessages: (appointmentId, messages) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [appointmentId]: messages,
      },
    }))
  },

  loadMessages: async (appointmentId, forceRefresh = false) => {
    const state = get()
    
    // Prevent duplicate loading
    if (state.loadingMessages[appointmentId]) return
    
    // Skip if messages already loaded (unless force refresh)
    if (!forceRefresh && state.messages[appointmentId]?.length > 0) return

    set((state) => ({
      loadingMessages: {
        ...state.loadingMessages,
        [appointmentId]: true,
      },
    }))

    try {
      const messages = await MessagesApi.fetchByAppointment(appointmentId)
      set((state) => ({
        messages: {
          ...state.messages,
          [appointmentId]: messages,
        },
      }))
    } catch (err) {
      console.error('Failed to load messages:', err)
    } finally {
      set((state) => ({
        loadingMessages: {
          ...state.loadingMessages,
          [appointmentId]: false,
        },
      }))
    }
  },

  markAsRead: (appointmentId) => {
    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [appointmentId]: 0,
      },
    }))
  },

  markMessagesAsReadByType: (appointmentId, senderType) => {
    set((state) => {
      const currentMessages = state.messages[appointmentId] || []
      
      // Mark all messages from the specified sender type as read
      // Используем хелпер getSenderType для работы с полиморфной связью
      const updatedMessages = currentMessages.map((msg) => {
        const msgSenderType = getSenderType(msg)
        if (msgSenderType === senderType && !msg.read) {
          return { ...msg, read: true }
        }
        return msg
      })

      return {
        messages: {
          ...state.messages,
          [appointmentId]: updatedMessages,
        },
      }
    })
  },

  setUnreadCount: (appointmentId, count) => {
    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [appointmentId]: count,
      },
    }))
  },

  incrementUnreadCount: (appointmentId) => {
    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [appointmentId]: (state.unreadCounts[appointmentId] || 0) + 1,
      },
    }))
  },

  setTypingUser: (appointmentId, typingUser) => {
    set((state) => ({
      typingUsers: {
        ...state.typingUsers,
        [appointmentId]: typingUser,
      },
    }))
  },

  updateAppointmentStatus: (appointmentId, status) => {
    set((state) => ({
      appointmentStatuses: {
        ...state.appointmentStatuses,
        [appointmentId]: status,
      },
    }))
  },

  setChatBlocked: (appointmentId, blocked) => {
    set((state) => ({
      chatBlocked: {
        ...state.chatBlocked,
        [appointmentId]: blocked,
      },
    }))
  },

  setConnectionType: (appointmentId, connectionType) => {
    set((state) => ({
      connectionTypes: {
        ...state.connectionTypes,
        [appointmentId]: connectionType,
      },
    }))
  },

  reset: () => set(initialState),
}))
