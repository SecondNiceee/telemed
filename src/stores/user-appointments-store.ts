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
  /**
   * Владелец закэшированных записей. Стор — синглтон на вкладку, поэтому без
   * этого ключа данные предыдущего аккаунта оставались бы на экране после
   * входа под другим пользователем (стор живёт до перезагрузки страницы).
   */
  userId: number | null

  /** Set appointments from server (for SSR hydration) */
  setAppointments: (appointments: ApiAppointment[], userId?: number | null) => void
  /** Fetch appointments of the given user (skips if already cached for them) */
  fetchAppointments: (userId: number) => Promise<void>
  /** Force refetch */
  refetchAppointments: (userId: number) => Promise<void>
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
  userId: null as number | null,
}

export const useUserAppointmentStore = create<UserAppointmentState>((set, get) => ({
  ...initialState,

  setAppointments: (appointments, userId) => {
    set({
      appointments,
      fetched: true,
      loading: false,
      ...(userId === undefined ? {} : { userId }),
    })
  },

  fetchAppointments: async (userId) => {
    const state = get()
    // Кэш валиден только для того же пользователя.
    if (state.fetched && state.userId === userId) return

    set({ loading: true, userId, appointments: state.userId === userId ? state.appointments : [] })
    try {
      const appointments = await AppointmentsApi.fetchMyAppointments(userId)
      // Пока шёл запрос, пользователь мог поменяться — тогда ответ уже неактуален.
      if (get().userId !== userId) return
      set({ appointments, fetched: true })
    } catch {
      if (get().userId !== userId) return
      set({ appointments: [], fetched: true })
    } finally {
      if (get().userId === userId) set({ loading: false })
    }
  },

  refetchAppointments: async (userId) => {
    set({ loading: true, fetched: false, userId })
    try {
      const appointments = await AppointmentsApi.fetchMyAppointments(userId)
      if (get().userId !== userId) return
      set({ appointments, fetched: true })
    } catch {
      if (get().userId !== userId) return
      set({ appointments: [], fetched: true })
    } finally {
      if (get().userId === userId) set({ loading: false })
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
