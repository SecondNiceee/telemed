import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { LkContent } from "@/components/lk-content"

export const dynamic = "force-dynamic"

export default function LkPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <LkContent />
      <Footer />
    </div>
  )
}
