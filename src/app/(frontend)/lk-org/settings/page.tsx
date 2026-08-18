import { headers } from "next/headers"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, Building2 } from "lucide-react"
import { Footer } from "@/components/footer"
import { OrgSupportPhone } from "@/components/lk-org/OrgSupportPhone"
import { Button } from "@/components/ui/button"
import { getSessionFromCookie } from "@/lib/auth/getSessionFromCookie"

export const metadata = {
  title: "Настройки организации | smartcardio",
  description: "Настройки профиля организации на платформе smartcardio",
}

export default async function LkOrgSettingsPage() {
  const requestHeaders = await headers()
  const org = await getSessionFromCookie<{
    id: number
    name?: string
    email: string
    supportPhone?: string | null
  }>(requestHeaders, "organisations-token", "organisations")

  if (!org) {
    redirect("/lk-org")
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <Button asChild variant="ghost" size="sm" className="mb-6">
            <Link href="/lk-org">
              <ArrowLeft data-icon="inline-start" />
              Вернуться в кабинет
            </Link>
          </Button>

          <header className="mb-8 flex items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
              <Building2 className="size-6 text-primary" aria-hidden="true" />
            </div>
            <div>
              <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Кабинет организации
              </p>
              <h1 className="text-balance text-2xl font-bold text-foreground">
                Настройки организации
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {org.name || org.email}
              </p>
            </div>
          </header>

          <OrgSupportPhone
            orgId={org.id}
            initialSupportPhone={org.supportPhone ?? ""}
          />
        </div>
      </main>
      <Footer />
    </div>
  )
}
