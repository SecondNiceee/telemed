import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { CategoriesSection } from "@/components/categories-section";
import { HowItWorks } from "@/components/how-it-works";
import { Footer } from "@/components/footer";
import { Suspense } from "react";

export const dynamic = 'force-dynamic'
export const revalidate = 0;

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Hero />
        <Suspense
          fallback={
            <section className="py-8 sm:py-10 bg-background">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                <p className="text-muted-foreground">Загрузка категорий...</p>
              </div>
            </section>
          }
        >
          <CategoriesSection />
        </Suspense>
        <HowItWorks />
      </main>
      <Footer />
    </div>
  );
}
