import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { CategoriesSection } from "@/components/categories-section";
import { HowItWorks } from "@/components/how-it-works";
import { Footer } from "@/components/footer";
import { Suspense } from "react";

// ISR: страница кэшируется и ревалидируется каждые 60 секунд.
// Если при билде API недоступен, CategoriesSection поймает ошибку
// и покажет fallback, а через ≤60 сек страница перегенерируется с данными.
// Точечная ревалидация по тегам (revalidateTag) тоже продолжает работать.
export const revalidate = 60;

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
