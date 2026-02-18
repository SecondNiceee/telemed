import { create } from 'zustand'
import type { User } from '@/payload-types'
import { AuthApi } from '@/lib/api/auth'

interface UserState {
  user: User | null
  loading: boolean
  fetched: boolean
  fetchUser: () => Promise<void>
  setUser: (user: User | null) => void
  logout: () => Promise<void>
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  loading: false,
  fetched: false,

  fetchUser: async () => {
    // If we already fetched, don't refetch
    if (get().fetched) return

    set({ loading: true })
    try {
      const user = await AuthApi.me()
      set({ user, fetched: true })
    } catch {
      set({ user: null, fetched: true })
    } finally {
      set({ loading: false })
    }
  },

  setUser: (user) => set({ user, fetched: true }),

  logout: async () => {
    await AuthApi.logout()
    set({ user: null, fetched: true })
    window.location.href = '/'
  },
}))
