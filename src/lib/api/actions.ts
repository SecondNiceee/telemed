"use server"

import { revalidateTag } from "next/cache"
import { CategoriesApi } from "./categories"
import { DoctorsApi, DOCTORS_CACHE_TAG } from "./doctors"
import type { ApiCategory, ApiDoctor } from "./types"

/**
 * Server action wrapper around CategoriesApi.fetchAll().
 * Keeps the server-side caching (next.tags) intact while
 * allowing client components to call it directly.
 */
export async function fetchCategoriesAction(): Promise<ApiCategory[]> {
  return CategoriesApi.fetchAll()
}

/**
 * Server action wrapper around DoctorsApi.fetchAll().
 * Keeps the server-side caching (next.tags) intact while
 * allowing client components to call it directly.
 */
export async function fetchDoctorsAction(): Promise<ApiDoctor[]> {
  return DoctorsApi.fetchAll()
}

/**
 * Server action wrapper around DoctorsApi.fetchByCategory().
 */
export async function fetchDoctorsByCategoryAction(categoryId: number): Promise<ApiDoctor[]> {
  return DoctorsApi.fetchByCategory(categoryId)
}

/**
 * Server action wrapper around DoctorsApi.fetchById().
 */
export async function fetchDoctorByIdAction(id: number | string): Promise<ApiDoctor> {
  return DoctorsApi.fetchById(id)
}

/**
 * Manually revalidate the doctors cache tag.
 * Useful after creating/updating a doctor from a client component.
 */
export async function revalidateDoctorsAction(): Promise<void> {
  revalidateTag(DOCTORS_CACHE_TAG)
}
