import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { LkContent } from "@/components/lk-content"
import { AuthApi } from "@/lib/api/auth"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function LkPage() {
  let user = null;
  try{
    user = await AuthApi.me();
    if (!user){
      redirect('/')
    }
    
  }
  catch(e){
    console.log(e);
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
