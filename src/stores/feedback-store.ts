import { create } from 'zustand'
import { FeedbacksApi } from '@/lib/api/feedbacks'
import type { ApiFeedback, ApiAppointment } from '@/lib/api/types'

interface FeedbackState {
  // Feedbacks by doctor ID
  feedbacksByDoctor: Record<number, ApiFeedback[]>
  
  // Whether feedback exists for an appointment
  feedbackExistsByAppointment: Record<number, boolean>
  
  // Loading states
  loadingByDoctor: Record<number, boolean>
  checkingByAppointment: Record<number, boolean>
  
  // User's completed appointments without feedback (for doctor page modal)
  userCompletedAppointmentsWithoutFeedback: ApiAppointment[]
  loadingUserAppointments: boolean
  
  // Actions
  loadFeedbacksByDoctor: (doctorId: number, forceRefresh?: boolean) => Promise<ApiFeedback[]>
  checkFeedbackExists: (appointmentId: number) => Promise<boolean>
  setFeedbackExists: (appointmentId: number, exists: boolean) => void
  addFeedback: (feedback: ApiFeedback) => void
  loadUserCompletedAppointmentsWithoutFeedback: (doctorId: number, appointments: ApiAppointment[]) => Promise<void>
  reset: () => void
}

const initialState = {
  feedbacksByDoctor: {} as Record<number, ApiFeedback[]>,
  feedbackExistsByAppointment: {} as Record<number, boolean>,
  loadingByDoctor: {} as Record<number, boolean>,
  checkingByAppointment: {} as Record<number, boolean>,
  userCompletedAppointmentsWithoutFeedback: [] as ApiAppointment[],
  loadingUserAppointments: false,
}

export const useFeedbackStore = create<FeedbackState>((set, get) => ({
  ...initialState,

  loadFeedbacksByDoctor: async (doctorId: number, forceRefresh = false) => {
    const state = get()
    
    // Return cached if already loaded (unless force refresh)
    if (!forceRefresh && state.feedbacksByDoctor[doctorId]) {
      return state.feedbacksByDoctor[doctorId]
    }
    
    // Prevent duplicate loading
    if (state.loadingByDoctor[doctorId]) {
      return []
    }

    set((s) => ({
      loadingByDoctor: { ...s.loadingByDoctor, [doctorId]: true },
    }))

    try {
      const feedbacks = await FeedbacksApi.getByDoctor(doctorId)
      set((s) => ({
        feedbacksByDoctor: { ...s.feedbacksByDoctor, [doctorId]: feedbacks },
      }))
      return feedbacks
    } catch (err) {
      console.error('Failed to load feedbacks:', err)
      return []
    } finally {
      set((s) => ({
        loadingByDoctor: { ...s.loadingByDoctor, [doctorId]: false },
      }))
    }
  },

  checkFeedbackExists: async (appointmentId: number) => {
    const state = get()
    
    // Return cached if already checked
    if (appointmentId in state.feedbackExistsByAppointment) {
      return state.feedbackExistsByAppointment[appointmentId]
    }
    
    // Prevent duplicate checking
    if (state.checkingByAppointment[appointmentId]) {
      return false
    }

    set((s) => ({
      checkingByAppointment: { ...s.checkingByAppointment, [appointmentId]: true },
    }))

    try {
      const exists = await FeedbacksApi.hasFeedback(appointmentId)
      set((s) => ({
        feedbackExistsByAppointment: { ...s.feedbackExistsByAppointment, [appointmentId]: exists },
      }))
      return exists
    } catch (err) {
      console.error('Failed to check feedback:', err)
      return false
    } finally {
      set((s) => ({
        checkingByAppointment: { ...s.checkingByAppointment, [appointmentId]: false },
      }))
    }
  },

  setFeedbackExists: (appointmentId: number, exists: boolean) => {
    set((s) => ({
      feedbackExistsByAppointment: { ...s.feedbackExistsByAppointment, [appointmentId]: exists },
    }))
  },

  addFeedback: (feedback: ApiFeedback) => {
    const doctorId = typeof feedback.doctor === 'object' ? feedback.doctor.id : feedback.doctor
    const appointmentId = typeof feedback.appointment === 'object' ? feedback.appointment.id : feedback.appointment

    set((s) => {
      const currentFeedbacks = s.feedbacksByDoctor[doctorId] || []
      return {
        feedbacksByDoctor: {
          ...s.feedbacksByDoctor,
          [doctorId]: [feedback, ...currentFeedbacks],
        },
        feedbackExistsByAppointment: {
          ...s.feedbackExistsByAppointment,
          [appointmentId]: true,
        },
      }
    })
  },

  loadUserCompletedAppointmentsWithoutFeedback: async (doctorId: number, appointments: ApiAppointment[]) => {
    set({ loadingUserAppointments: true })

    try {
      // Filter to completed appointments with this doctor
      const completedWithDoctor = appointments.filter((a) => {
        const apptDoctorId = typeof a.doctor === 'object' ? a.doctor.id : a.doctor
        return a.status === 'completed' && apptDoctorId === doctorId
      })

      // Check which ones don't have feedback
      const withoutFeedback: ApiAppointment[] = []
      
      for (const appt of completedWithDoctor) {
        const exists = await get().checkFeedbackExists(appt.id)
        if (!exists) {
          withoutFeedback.push(appt)
        }
      }

      set({ userCompletedAppointmentsWithoutFeedback: withoutFeedback })
    } catch (err) {
      console.error('Failed to load appointments without feedback:', err)
      set({ userCompletedAppointmentsWithoutFeedback: [] })
    } finally {
      set({ loadingUserAppointments: false })
    }
  },

  reset: () => set(initialState),
}))
