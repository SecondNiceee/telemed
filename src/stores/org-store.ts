import { create } from 'zustand'
import { OrgAuthApi, type ApiOrganisation } from '@/lib/api/org-auth'

interface OrgState {
  org: ApiOrganisation | null
  loading: boolean
  fetched: boolean

  fetchOrg: () => Promise<void>
  refetchOrg: () => Promise<void>
  setOrg: (org: ApiOrganisation | null) => void
  login: (email: string, password: string) => Promise<ApiOrganisation>
  logout: () => Promise<void>
  reset: () => void
}

const initialState = {
  org: null,
  loading: false,
  fetched: false,
}

export const useOrgStore = create<OrgState>((set, get) => ({
  ...initialState,

  fetchOrg: async () => {
    if (get().fetched) return

    set({ loading: true })
    try {
      const org = await OrgAuthApi.me()
      set({ org, fetched: true })
    } catch {
      set({ org: null, fetched: true })
    } finally {
      set({ loading: false })
    }
  },

  refetchOrg: async () => {
    set({ loading: true, fetched: false })
    try {
      const org = await OrgAuthApi.me()
      set({ org, fetched: true })
    } catch {
      set({ org: null, fetched: true })
    } finally {
      set({ loading: false })
    }
  },

  setOrg: (org) => set({ org, fetched: true }),

  login: async (email, password) => {
    set({ loading: true })
    try {
      const result = await OrgAuthApi.login(email, password)
      set({ org: result.user, fetched: true })
      return result.user
    } finally {
      set({ loading: false })
    }
  },

  logout: async () => {
    set({ loading: true })
    try {
      await OrgAuthApi.logout()
      set({ ...initialState, fetched: true })
    } finally {
      set({ loading: false })
    }
    window.location.href = '/'
  },

  reset: () => set(initialState),
}))
