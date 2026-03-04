import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { LkContent } from "@/components/lk-content"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { getBaseUrl } from "@/lib/api/fetch"

export const dynamic = "force-dynamic"

export default async function LkPage() {
  let user = null;
  try {
    const hdrs = await headers()
    const cookie = hdrs.get("cookie") ?? ""
    const baseUrl = getBaseUrl()
    const res = await fetch(`${baseUrl}/api/users/me`, {
      headers: { cookie },
      cache: "no-store",
    })
    if (res.ok) {
      const data = await res.json()
      user = data.user ?? null
    }
    if (!user) {
      redirect("/")
    }
  } catch (e) {
    // redirect() throws a special Next.js error — rethrow it
    if (e && typeof e === "object" && "digest" in e) throw e
    console.log(e)
    redirect("/")
  }
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <LkContent user={user} />
      <Footer />
    </div>
  )
}
