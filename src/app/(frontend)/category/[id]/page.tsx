import { notFound } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { DoctorCard } from "@/components/doctor-card";
import { Button } from "@/components/ui/button";
import {
  fetchCategoryBySlug,
  fetchDoctorsByCategory,
  ApiError,
  getErrorMessage,
  type ApiDoctor,
  type ApiCategory,
} from "@/lib/api/index";
import { ArrowLeft } from "lucide-react";
import { User } from "@/payload-types";

interface CategoryPageProps {
  params: Promise<{ id: string }>;
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

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { id: slug } = await params;

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
        <Header />
        <main className="flex-1 flex items-center justify-center bg-background">
          <div className="text-center px-4">
            <p className="text-destructive text-lg mb-4">{error}</p>
            <Button variant="outline" asChild className="border-primary text-primary hover:bg-primary/5 transition-all">
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
      <Header />
      <main className="flex-1 bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <Button variant="ghost" size="sm" asChild className="mb-4">
              <Link href="/#categories">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Назад к категориям
              </Link>
            </Button>
            
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
                {category!.name}
              </h1>
              <p className="text-muted-foreground text-lg">
                {category!.description}
              </p>
              <p className="text-sm text-muted-foreground">
                Найдено врачей: <span className="font-medium text-foreground">{doctors.length}</span>
              </p>
            </div>
          </div>

          {doctors.length > 0 ? (
            <div className="grid gap-3">
              {doctors.map((doctor) => (
                <DoctorCard key={doctor.id} doctor={doctor} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg">
                В данной категории пока нет врачей
              </p>
              <Button variant="outline" asChild className="mt-4 border-primary text-primary hover:bg-primary/5 transition-all">
                <Link href="/#categories">Выбрать другую категорию</Link>
              </Button>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
