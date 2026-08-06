import { headers } from "next/headers"
import { Footer } from "@/components/footer"
import { LkOrgCategoryCreate } from "@/components/lk-org-category-create"
import { getSessionFromCookie } from "@/lib/auth/getSessionFromCookie"
import { redirect } from "next/navigation"

export const metadata = {
  title: "Добавить специальность | smartcardio",
  description: "Добавление новой специальности для врачей",
}

export default async function LkOrgCategoryCreatePage() {
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
      <LkOrgCategoryCreate />
      <Footer />
    </div>
  )
}
