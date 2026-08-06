import { create } from 'zustand'
import { AppointmentsApi, type CreateAppointmentPayload } from '@/lib/api/appointments'
import type { ApiAppointment, ApiDoctor } from '@/lib/api/types'

export interface CreateAppointmentWithDoctorPayload extends CreateAppointmentPayload {
  /** Full doctor object to embed in the appointment */
  doctorData?: Partial<ApiDoctor>
}

interface UserAppointmentState {
  appointments: ApiAppointment[]
  loading: boolean
  fetched: boolean
  creating: boolean

  /** Set appointments from server (for SSR hydration) */
  setAppointments: (appointments: ApiAppointment[]) => void
  /** Fetch current user appointments */
  fetchAppointments: () => Promise<void>
  /** Force refetch */
  refetchAppointments: () => Promise<void>
  /** Create a new appointment with full doctor info */
  createAppointment: (data: CreateAppointmentWithDoctorPayload) => Promise<ApiAppointment>
  /** Reset store */
  reset: () => void
}

const initialState = {
  appointments: [] as ApiAppointment[],
  loading: false,
  fetched: false,
  creating: false,
}

export const useUserAppointmentStore = create<UserAppointmentState>((set, get) => ({
  ...initialState,

  setAppointments: (appointments) => {
    set({ appointments, fetched: true, loading: false })
  },

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
      const { doctorData, ...payload } = data
      const appointment = await AppointmentsApi.create(payload)
      
      // Use the API response directly - it has the correct data
      // Only enrich doctor object if API returned just an ID and we have doctorData
      const enrichedAppointment: ApiAppointment = {
        ...appointment,
        doctor: (typeof appointment.doctor === 'number' && doctorData) 
          ? { 
              id: payload.doctor,
              email: doctorData.email || '',
              name: doctorData.name,
              ...doctorData 
            } as ApiDoctor 
          : appointment.doctor,
      }
      
      set((state) => ({
        appointments: [enrichedAppointment, ...state.appointments],
      }))
      return enrichedAppointment
    } finally {
      set({ creating: false })
    }
  },

  reset: () => set(initialState),
}))
