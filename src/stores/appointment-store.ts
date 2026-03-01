import { create } from 'zustand'
import { AppointmentsApi, type CreateAppointmentPayload } from '@/lib/api/appointments'
import { DOCTORS_CACHE_TAG } from '@/lib/api/doctors'
import type { ApiAppointment } from '@/lib/api/types'

async function revalidateDoctorsCache() {
  try {
    await fetch('/api/revalidate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag: DOCTORS_CACHE_TAG }),
    })
  } catch {
    // non-critical: Payload hooks also attempt revalidation
  }
}

interface AppointmentState {
  appointments: ApiAppointment[]
  loading: boolean
  fetched: boolean
  creating: boolean

  /** Fetch current user/doctor appointments */
  fetchAppointments: () => Promise<void>
  /** Force refetch */
  refetchAppointments: () => Promise<void>
  /** Create a new appointment */
  createAppointment: (data: CreateAppointmentPayload) => Promise<ApiAppointment>
  /** Reset store */
  reset: () => void
}

const initialState = {
  appointments: [] as ApiAppointment[],
  loading: false,
  fetched: false,
  creating: false,
}

export const useAppointmentStore = create<AppointmentState>((set, get) => ({
  ...initialState,

  fetchAppointments: async () => {
    if (get().fetched) return

    set({ loading: true })
    try {
      const appointments = await AppointmentsApi.fetchMyAppointments()
      set({ appointments, fetched: true })
    } catch {
      set({ appointments: [], fetched: true })
    } finally {
      set({ loading: false })
    }
  },

  refetchAppointments: async () => {
    set({ loading: true, fetched: false })
    try {
      const appointments = await AppointmentsApi.fetchMyAppointments()
      set({ appointments, fetched: true })
    } catch {
      set({ appointments: [], fetched: true })
    } finally {
      set({ loading: false })
    }
  },

  createAppointment: async (data) => {
    set({ creating: true })
    try {
      const appointment = await AppointmentsApi.create(data)
      set((state) => ({
        appointments: [appointment, ...state.appointments],
      }))
      // Trigger Next.js Data Cache revalidation so booking page shows fresh schedule
      await revalidateDoctorsCache()
      return appointment
    } finally {
      set({ creating: false })
    }
  },

  reset: () => set(initialState),
}))
