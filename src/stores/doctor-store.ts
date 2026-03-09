import { create } from 'zustand'
import { DoctorAuthApi } from '@/lib/api/doctor-auth'
import type { ApiDoctor } from '@/lib/api/types'
import { toast } from 'sonner'
import { useDoctorAppointmentStore } from './doctor-appointments-store'

interface DoctorState {
  doctor: ApiDoctor | null
  loading: boolean
  fetched: boolean

  fetchDoctor: () => Promise<void>
  refetchDoctor: () => Promise<void>
  setDoctor: (doctor: ApiDoctor | null) => void
  login: (email: string, password: string) => Promise<ApiDoctor>
  logout: () => Promise<void>
  reset: () => void
}

const initialState = {
  doctor: null,
  loading: false,
  fetched: false,
}

export const useDoctorStore = create<DoctorState>((set, get) => ({
  ...initialState,

  fetchDoctor: async () => {
    if (get().fetched) return

    set({ loading: true })
    try {
      const doctor = await DoctorAuthApi.me()
      set({ doctor, fetched: true })
    } catch {
      set({ doctor: null, fetched: true })
    } finally {
      set({ loading: false })
    }
  },

  refetchDoctor: async () => {
    set({ loading: true, fetched: false })
    try {
      const doctor = await DoctorAuthApi.me()
      set({ doctor, fetched: true })
    } catch {
      set({ doctor: null, fetched: true })
    } finally {
      set({ loading: false })
    }
  },

  setDoctor: (doctor) => set({ doctor, fetched: true }),

  login: async (email, password) => {
    set({ loading: true })
    try {
      const result = await DoctorAuthApi.login(email, password)
      set({ doctor: result.user, fetched: true })
      return result.user
    } finally {
      set({ loading: false })
    }
  },

  logout: async () => {
    set({ loading: true })
    try {
      await DoctorAuthApi.logout()
      set({ ...initialState, fetched: true })
      // Clear doctor appointments store
      useDoctorAppointmentStore.getState().reset()
      toast.success("Вы успешно вышли из аккаунта")
    } finally {
      set({ loading: false })
    }
    setTimeout(() => { window.location.href = process.env.NEXT_PUBLIC_BASE_PATH || '/' }, 500)
  },

  reset: () => set(initialState),
}))
