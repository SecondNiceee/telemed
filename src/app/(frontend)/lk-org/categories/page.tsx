import { headers } from "next/headers"
import { Footer } from "@/components/footer"
import { LkOrgCategoriesList } from "@/components/lk-org-categories-list"
import { getSessionFromCookie } from "@/lib/auth/getSessionFromCookie"
import { redirect } from "next/navigation"

export const metadata = {
  title: "Специальности врачей | smartcardio",
  description: "Управление специальностями и категориями врачей",
}

export default async function LkOrgCategoriesPage() {
  const requestHeaders = await headers()

  const org = await getSessionFromCookie<{ id: number; name?: string; email: string }>(
    requestHeaders,
    'organisations-token',
    'organisations',
  )

  // Redirect to login if not authenticated as organisation
  if (!org) {
    redirect('/lk-org')
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <LkOrgCategoriesList />
      <Footer />
    </div>
  )
}
