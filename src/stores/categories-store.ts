import { create } from 'zustand'
import { CategoriesApi, type CreateCategoryPayload } from '@/lib/api/categories'
import type { ApiCategory } from '@/lib/api/types'
import { revalidateCategoriesAction } from '@/lib/api/actions'

interface CategoriesState {
  categories: ApiCategory[]
  loading: boolean
  fetched: boolean

  fetchCategories: () => Promise<void>
  refetchCategories: () => Promise<void>
  createCategory: (data: CreateCategoryPayload) => Promise<ApiCategory>
  updateCategory: (id: number, data: Partial<CreateCategoryPayload>) => Promise<ApiCategory>
  deleteCategory: (id: number) => Promise<void>
  reset: () => void
}

const initialState = {
  categories: [],
  loading: false,
  fetched: false,
}

export const useCategoriesStore = create<CategoriesState>((set, get) => ({
  ...initialState,

  fetchCategories: async () => {
    if (get().fetched) return

    set({ loading: true })
    try {
      const categories = await CategoriesApi.fetchAll()
      set({ categories, fetched: true })
    } catch {
      set({ categories: [], fetched: true })
    } finally {
      set({ loading: false })
    }
  },

  refetchCategories: async () => {
    set({ loading: true, fetched: false })
    try {
      const categories = await CategoriesApi.fetchAll()
      set({ categories, fetched: true })
    } catch {
      set({ categories: [], fetched: true })
    } finally {
      set({ loading: false })
    }
  },

  createCategory: async (data) => {
    set({ loading: true })
    try {
      const newCategory = await CategoriesApi.create(data)
      const categories = get().categories
      set({ categories: [...categories, newCategory], fetched: false })
      // Revalidate cache on server
      await revalidateCategoriesAction()
      // Refetch to ensure cache is updated
      await get().refetchCategories()
      return newCategory
    } finally {
      set({ loading: false })
    }
  },

  updateCategory: async (id, data) => {
    set({ loading: true })
    try {
      const updatedCategory = await CategoriesApi.update(id, data)
      const categories = get().categories.map((c) =>
        c.id === id ? updatedCategory : c
      )
      set({ categories })
      await revalidateCategoriesAction()
      await get().refetchCategories()
      return updatedCategory
    } finally {
      set({ loading: false })
    }
  },

  deleteCategory: async (id) => {
    set({ loading: true })
    try {
      await CategoriesApi.delete(id)
      const categories = get().categories.filter((c) => c.id !== id)
      set({ categories })
      await revalidateCategoriesAction()
    } finally {
      set({ loading: false })
    }
  },

  reset: () => set(initialState),
}))
