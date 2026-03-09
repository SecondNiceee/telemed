import { create } from 'zustand'
import { DoctorAuthApi } from '@/lib/api/doctor-auth'
import type { ApiDoctor } from '@/lib/api/types'
import { toast } from 'sonner'

interface DoctorState {
  doctor: ApiDoctor | null
  loading: boolean

  /** Set doctor manually (for initial hydration from server) */
  setDoctor: (doctor: ApiDoctor | null) => void
  /** Login with email/password */
  login: (email: string, password: string) => Promise<ApiDoctor>
  /** Logout and redirect to home */
  logout: () => Promise<void>
  /** Reset store to initial state */
  reset: () => void
}

const initialState = {
  doctor: null,
  loading: false,
}

export const useDoctorStore = create<DoctorState>((set) => ({
  ...initialState,

  setDoctor: (doctor) => set({ doctor }),

  login: async (email, password) => {
    set({ loading: true })
    try {
      const result = await DoctorAuthApi.login(email, password)
      set({ doctor: result.user })
      return result.user
    } finally {
      set({ loading: false })
    }
  },

  logout: async () => {
    set({ loading: true })
    try {
      await DoctorAuthApi.logout()
      set({ ...initialState })
      toast.success("Вы успешно вышли из аккаунта")
    } finally {
      set({ loading: false })
    }
    setTimeout(() => { window.location.href = process.env.NEXT_PUBLIC_BASE_PATH || '/' }, 500)
  },

  reset: () => set(initialState),
}))
