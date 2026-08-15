import { notFound } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import {
  fetchCategoryBySlug,
  fetchDoctorsByCategory,
  ApiError,
  getErrorMessage,
  type ApiDoctor,
  type ApiCategory,
} from "@/lib/api/index";
import { CategoryPageClient } from "./category-client";
import { BackButton } from "@/components/back-button";
import { BackgroundDecor } from "@/components/background-decor";
import { SectionBadge } from "@/components/section-badge";

interface CategoryPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}

export async function generateMetadata({ params }: CategoryPageProps) {
  const { id } = await params;

  try {
    const category = await fetchCategoryBySlug(id);
    return {
      title: category ? `${category.name} - smartcardio` : "Категория не найдена",
      description: category?.description || "Найдите врача и запишитесь на прием",
    };
  } catch {
    return {
      title: "Категория - smartcardio",
      description: "Найдите врача и запишитесь на прием",
    };
  }
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { id: slug } = await params;
  const { date: selectedDate } = await searchParams;

  let category: ApiCategory | null = null;
  let doctors: ApiDoctor[] = [];
  let error: string | null = null;

  try {
    category = await fetchCategoryBySlug(slug);
    if (!category) {
      notFound();
    }
    doctors = await fetchDoctorsByCategory(category.id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    error = getErrorMessage(err);
    doctors = [];
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col">
        <BackgroundDecor id="category-error" position="fixed" ecg={false} />
        <Header />
        <main className="relative z-10 flex-1 flex items-center justify-center">
          <div className="text-center px-4">
            <p className="text-destructive text-lg mb-4">{error}</p>
            <Button variant="outline" asChild className="rounded-full border-teal/40 text-teal hover:bg-teal/10 hover:text-teal transition-all">
              <Link href="/#categories">Назад к категориям</Link>
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <BackgroundDecor id="category" position="fixed" ecg={false} />
      <Header />
      <main className="relative z-10 flex-1">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <BackButton fallbackHref="/appointment" className="mb-4" />

            <div className="space-y-3">
              <SectionBadge tone="teal">Специалисты</SectionBadge>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground text-balance">
                {category!.name}
              </h1>
              <span
                aria-hidden="true"
                className="block h-[2px] w-28 rounded-full"
                style={{
                  background:
                    "linear-gradient(to right, var(--teal) 0%, var(--primary) 70%, transparent 100%)",
                }}
              />
              <p className="text-muted-foreground text-lg text-pretty">
                {category!.description}
              </p>
            </div>
          </div>

          <CategoryPageClient 
            doctors={doctors} 
            initialSelectedDate={selectedDate}
          />
        </div>
      </main>
      <Footer />
    </div>
  );
}
