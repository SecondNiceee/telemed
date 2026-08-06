import { headers } from "next/headers"
import { Footer } from "@/components/footer"
import { LkOrgCategoryEdit } from "@/components/lk-org-category-edit"
import { getSessionFromCookie } from "@/lib/auth/getSessionFromCookie"
import { redirect } from "next/navigation"

export const metadata = {
  title: "Редактировать специальность | smartcardio",
  description: "Редактирование специальности врачей",
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function LkOrgCategoryEditPage({ params }: PageProps) {
  const { id } = await params
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
      <LkOrgCategoryEdit categoryId={parseInt(id, 10)} />
      <Footer />
    </div>
  )
}
