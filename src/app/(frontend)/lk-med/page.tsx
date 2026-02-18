import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getPayload } from "payload"
import config from "@payload-config"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { LkMedContent } from "@/components/lk-med-content"
import { CategoriesApi } from "@/lib/api/categories"

export const metadata = {
  title: "Кабинет организации | smartcardio",
  description: "Управление врачами организации на платформе smartcardio Телемедицина",
}

export default async function LkMedPage() {
  const payload = await getPayload({ config })
  const requestHeaders = await headers()

  let user = null
  try {
    const authResult = await payload.auth({ headers: requestHeaders })
    user = authResult.user
  } catch {
    redirect("/")
  }

  if (!user || (user.role !== "organisation" && user.role !== "admin")) {
    redirect("/")
  }

  const categories = await CategoriesApi.fetchAll().catch(() => [])

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <LkMedContent
        userName={user.name || user.email}
        categories={categories}
      />
      <Footer />
    </div>
  )
}
