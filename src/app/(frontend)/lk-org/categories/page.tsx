import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { Footer } from "@/components/footer"
import { LkOrgCategories } from "@/components/lk-org-categories"
import { getSessionFromCookie } from "@/lib/auth/getSessionFromCookie"
import { CategoriesApi } from "@/lib/api/categories"

export const metadata = {
  title: "Специализации | smartcardio",
  description: "Управление специализациями врачей на платформе smartcardio Телемедицина",
}

export default async function CategoriesPage() {
  const requestHeaders = await headers()

  const org = await getSessionFromCookie<{ id: number; name?: string; email: string }>(
    requestHeaders,
    'organisations-token',
    'organisations',
  )

  if (!org) {
    redirect("/lk-org")
  }

  const categories = await CategoriesApi.fetchAll()

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <LkOrgCategories initialCategories={categories} />
      <Footer />
    </div>
  )
}
