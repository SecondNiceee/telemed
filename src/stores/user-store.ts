import { create } from 'zustand'
import type { User } from '@/payload-types'
import { AuthApi } from '@/lib/api/auth'
import { toast } from 'sonner'

interface UserState {
  user: User | null
  loading: boolean

  /** Set user manually (for initial hydration from server) */
  setUser: (user: User | null) => void
  /** Login with email/password, stores user on success */
  login: (email: string, password: string) => Promise<User>
  /** Logout and redirect to home */
  logout: () => Promise<void>
  /** Reset store to initial state */
  reset: () => void
}

const initialState = {
  user: null,
  loading: false,
}

export const useUserStore = create<UserState>((set) => ({
  ...initialState,

  setUser: (user) => set({ user }),

  login: async (email, password) => {
    set({ loading: true })
    try {
      const result = await AuthApi.login(email, password)
      set({ user: result.user })
      return result.user
    } finally {
      set({ loading: false })
    }
  },

  logout: async () => {
    set({ loading: true })
    try {
      await AuthApi.logout()
      set({ ...initialState })
      toast.success("Вы успешно вышли из аккаунта")
    } finally {
      set({ loading: false })
    }
    setTimeout(() => { window.location.href = process.env.NEXT_PUBLIC_BASE_PATH || '/' }, 500)
  },

  reset: () => set(initialState),
}))
