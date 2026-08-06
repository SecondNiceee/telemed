import { create } from 'zustand'
import type { User } from '@/payload-types'
import { AuthApi } from '@/lib/api/auth'
import { toast } from 'sonner'
import { useUserAppointmentStore } from './user-appointments-store'

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
  /** Register a new user (self-registration). Returns the created user doc. */
  register: (name: string, email: string, password: string) => Promise<void>
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
      const user = await AuthApi.me();
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

  register: async (name, email, password) => {
    set({ loading: true })
    try {
      await AuthApi.register({ name, email, password })
      // User is not yet verified so we don't set user in store here.
      // They will need to confirm email first.
    } catch (err) {
      throw err
    } finally {
      set({ loading: false })
    }
  },

  logout: async () => {
    set({ loading: true })
    try {
      await AuthApi.logout()
      set({ ...initialState, fetched: true })
      // Clear user appointments store
      useUserAppointmentStore.getState().reset()
      toast.success("Вы успешно вышли из аккаунта")
    } finally {
      set({ loading: false })
    }
    // Only redirect if not already on home page
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '/'
    const currentPath = window.location.pathname
    if (currentPath !== '/' && currentPath !== basePath) {
      window.location.href = basePath
    }
  },

  reset: () => set(initialState),
}))
