import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { Footer } from "@/components/footer"
import { LkOrgCategoryCreate } from "@/components/lk-org-category-create"
import { getSessionFromCookie } from "@/lib/auth/getSessionFromCookie"

export const metadata = {
  title: "Создание специализации | smartcardio",
  description: "Создание новой специализации врачей на платформе smartcardio Телемедицина",
}

export default async function CategoryCreatePage() {
  const requestHeaders = await headers()

  const org = await getSessionFromCookie<{ id: number; name?: string; email: string }>(
    requestHeaders,
    'organisations-token',
    'organisations',
  )

  if (!org) {
    redirect("/lk-org")
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <LkOrgCategoryCreate />
      <Footer />
    </div>
  )
}
