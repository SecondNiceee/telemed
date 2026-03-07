import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { CategoriesSection } from "@/components/categories-section";
import { HowItWorks } from "@/components/how-it-works";
import { FaqSection } from "@/components/faq-section";
import { Footer } from "@/components/footer";
import { SectionReveal } from "@/components/section-reveal";
import { Suspense } from "react";
import type { SiteSettings } from "@/lib/api/site-settings";

async function getSiteSettings(): Promise<SiteSettings | null> {
  try {
    const baseUrl = process.env.SERVER_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/globals/site-settings`, {
      next: { tags: ["site-settings"] },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const siteSettings = await getSiteSettings();

  return (
    <div className="min-h-screen flex flex-col">  
      <Header />
      <main className="flex-1">
        <Hero
          title={siteSettings?.heroTitle}
          subtitle={siteSettings?.heroSubtitle}
        />
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
        <SectionReveal delay={80}>
          <HowItWorks />
        </SectionReveal>
        {siteSettings?.faq && siteSettings.faq.length > 0 && (
          <SectionReveal delay={120}>
            <FaqSection items={siteSettings.faq} />
          </SectionReveal>
        )}
      </main>
      <Footer />
    </div>
  );
}
