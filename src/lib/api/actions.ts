"use server"

import { CategoriesApi } from "./categories"
import type { ApiCategory } from "./types"

/**
 * Server action wrapper around CategoriesApi.fetchAll().
 * Keeps the server-side caching (next.tags) intact while
 * allowing client components to call it directly.
 */
export async function fetchCategoriesAction(): Promise<ApiCategory[]> {
  return CategoriesApi.fetchAll()
}
