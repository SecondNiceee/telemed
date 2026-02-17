import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getPayload } from "payload"
import config from "@payload-config"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

export const metadata = {
  title: "Личный кабинет врача | smartcardio",
  description: "Личный кабинет врача на платформе smartcardio Телемедицина",
}

export default async function DoctorDashboardPage() {
  const payload = await getPayload({ config })
  const requestHeaders = await headers()

  let user = null
  try {
    const authResult = await payload.auth({ headers: requestHeaders })
    user = authResult.user
  } catch {
    redirect("/")
  }

  if (!user || (user.role !== "doctor" && user.role !== "admin")) {
    redirect("/")
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 flex items-center justify-center">
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <h1 className="text-3xl font-bold text-foreground mb-4">
            Личный кабинет врача
          </h1>
          <p className="text-muted-foreground text-lg">
            Добро пожаловать, {user.name || user.email}
          </p>
        </div>
      </main>
      <Footer />
    </div>
  )
}
