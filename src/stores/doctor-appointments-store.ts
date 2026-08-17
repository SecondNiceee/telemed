import { create } from 'zustand'
import { AppointmentsApi } from '@/lib/api/appointments'
import type { ApiAppointment } from '@/lib/api/types'

interface DoctorAppointmentState {
  appointments: ApiAppointment[]
  loading: boolean
  fetched: boolean

  /** Set appointments from server (for SSR hydration) */
  setAppointments: (appointments: ApiAppointment[]) => void
  /** Fetch current doctor appointments (doctorId фильтрует выборку по врачу) */
  fetchAppointments: (doctorId: number) => Promise<void>
  /** Force refetch */
  refetchAppointments: (doctorId: number) => Promise<void>
  /** Update appointment status */
  updateAppointmentStatus: (appointmentId: number, status: ApiAppointment['status']) => void
  /** Reset store */
  reset: () => void
}

const initialState = {
  appointments: [] as ApiAppointment[],
  loading: false,
  fetched: false,
}

export const useDoctorAppointmentStore = create<DoctorAppointmentState>((set, get) => ({
  ...initialState,

  setAppointments: (appointments) => {
    set({ appointments, fetched: true, loading: false })
  },

  fetchAppointments: async (doctorId) => {
    if (get().fetched) return

    set({ loading: true })
    try {
      // Кабинет врача: выборка по doctor, а не fetchMyAppointments (тот
      // рассчитан на пациента и без фильтра по врачу тянет чужие записи).
      const appointments = await AppointmentsApi.fetchDoctorAppointments(doctorId)
      set({ appointments, fetched: true })
    } catch {
      set({ appointments: [], fetched: true })
    } finally {
      set({ loading: false })
    }
  },

  refetchAppointments: async (doctorId) => {
    set({ loading: true, fetched: false })
    try {
      const appointments = await AppointmentsApi.fetchDoctorAppointments(doctorId)
      set({ appointments, fetched: true })
    } catch {
      set({ appointments: [], fetched: true })
    } finally {
      set({ loading: false })
    }
  },

  updateAppointmentStatus: (appointmentId, status) => {
    set((state) => ({
      appointments: state.appointments.map((a) =>
        a.id === appointmentId ? { ...a, status } : a
      ),
    }))
  },

  reset: () => set(initialState),
}))
