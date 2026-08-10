import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { CategoriesSection } from "@/components/categories-section";

import { FaqSection } from "@/components/faq-section";
import { Footer } from "@/components/footer";
import { SectionReveal } from "@/components/section-reveal";
import { ReviewsSection } from "@/components/reviews-section";
import { AdvantagesSection } from "@/components/advantages-section";
// Временно скрытые секции (см. ниже в разметке)
// import { EcgDeviceSection } from "@/components/ecg-device-section";
// import { AutoEcgTransferSection } from "@/components/auto-ecg-transfer-section";
// import { HowItWorksSection } from "@/components/how-it-works-section";
import { Suspense } from "react";
import { fetchSiteSettingsLocal } from "@/lib/api/site-settings.server";
import { headers } from "next/headers";
import { AuthApi } from "@/lib/api/auth";

// Enable ISR - revalidate on-demand via revalidateTag, 
// or automatically every 60 seconds as fallback
export const revalidate = 60;

export default async function HomePage() {
  // Use Payload Local API directly to avoid fetch issues during build
  const siteSettings = await fetchSiteSettingsLocal();
  
  // SSR fetch current user
  const hdrs = await headers();
  const cookie = hdrs.get('cookie') ?? '';
  const user = await AuthApi.meServer({ cookie });

  return (
    <div className="min-h-screen flex flex-col">  
      <Header />
      <main className="flex-1">
        <Hero user={user} />
        <SectionReveal delay={0}>
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
        </SectionReveal>

        <SectionReveal delay={100}>
          <AdvantagesSection />
        </SectionReveal>
        {/* Временно скрыто: секция "Автоматическая передача данных ЭКГ"
        <SectionReveal delay={110}>
          <AutoEcgTransferSection />
        </SectionReveal>
        */}
        {/* Временно скрыто: секция "Подробнее о приборе"
        <SectionReveal delay={115}>
          <EcgDeviceSection />
        </SectionReveal>
        */}
        {/* Временно скрыто: секция "Как это работает"
        <SectionReveal delay={118}>
          <HowItWorksSection />
        </SectionReveal>
        */}
        <SectionReveal delay={120}>
          <ReviewsSection />
        </SectionReveal>
        <SectionReveal delay={140}>
          <FaqSection />
        </SectionReveal>
      </main>
      <Footer />
    </div>
  );
}
