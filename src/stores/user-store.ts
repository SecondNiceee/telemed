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
  /**
   * Register a new user (self-registration). Отправляет письмо для подтверждения email.
   *
   * Согласия передаются объектом, а не двумя булевыми аргументами подряд:
   * `register(name, email, phone, pass, true, false)` при перестановке местами
   * молча записал бы принятие оферты как согласие на обработку данных о здоровье,
   * и компилятор бы этого не заметил.
   */
  register: (params: {
    name: string
    email: string
    phone: string
    password: string
    pdnConsentAccepted: boolean
    offerAccepted: boolean
  }) => Promise<void>
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
      // Стор записей — синглтон на вкладку: без сброса в нём остаются
      // консультации предыдущего аккаунта (баннер «Консультация через …»).
      useUserAppointmentStore.getState().reset()
      set({ user: result.user, fetched: true })
      return result.user
    } finally {
      set({ loading: false })
    }
  },

  register: async (params) => {
    set({ loading: true })
    try {
      // Согласия приходят параметрами, а не подставляются здесь: значение true
      // по умолчанию было бы отметкой о согласии, которого никто не давал.
      await AuthApi.register(params)
      // Email ещё не подтверждён, поэтому пользователя в стор не пишем —
      // сначала нужно перейти по ссылке из письма.
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
    if (window.location.pathname !== '/') {
      window.location.href = '/'
    }
  },

  reset: () => set(initialState),
}))
