import { create } from 'zustand'
import type { User } from '@/payload-types'
import { AuthApi } from '@/lib/api/auth'

interface UserState {
  user: User | null
  loading: boolean
  fetched: boolean

  /** Fetch current user (skips if already fetched) */
  fetchUser: () => Promise<void>
  /** Force refetch current user (ignores fetched flag) */
  refetchUser: () => Promise<void>
  /** Set user manually */
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
  fetched: false,
}

export const useUserStore = create<UserState>((set, get) => ({
  ...initialState,

  fetchUser: async () => {
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

  refetchUser: async () => {
    set({ loading: true, fetched: false })
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

  login: async (email, password) => {
    set({ loading: true })
    try {
      const result = await AuthApi.login(email, password)
      set({ user: result.user, fetched: true })
      return result.user
    } finally {
      set({ loading: false })
    }
  },

  logout: async () => {
    set({ loading: true })
    try {
      await AuthApi.logout()
      set({ ...initialState, fetched: true })
    } finally {
      set({ loading: false })
    }
    window.location.href = '/'
  },

  reset: () => set(initialState),
}))
