import { notFound } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { DoctorCard } from "@/components/doctor-card";
import { Button } from "@/components/ui/button";
import { getCategoryById, getDoctorsByCategory, categories } from "@/lib/data";
import { ArrowLeft } from "lucide-react";

interface CategoryPageProps {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  return categories.map((category) => ({
    id: category.id,
  }));
}

export async function generateMetadata({ params }: CategoryPageProps) {
  const { id } = await params;
  const category = getCategoryById(id);
  
  return {
    title: category ? `${category.name} - МедОнлайн` : "Категория не найдена",
    description: category?.description || "Найдите врача и запишитесь на прием",
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { id } = await params;
  const category = getCategoryById(id);
  const doctors = getDoctorsByCategory(id);

  if (!category) {
    notFound();
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
                {category.name}
              </h1>
              <p className="text-muted-foreground text-lg">
                {category.description}
              </p>
              <p className="text-sm text-muted-foreground">
                Найдено врачей: <span className="font-medium text-foreground">{doctors.length}</span>
              </p>
            </div>
          </div>

          {doctors.length > 0 ? (
            <div className="grid gap-6">
              {doctors.map((doctor) => (
                <DoctorCard key={doctor.id} doctor={doctor} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg">
                В данной категории пока нет врачей
              </p>
              <Button asChild className="mt-4 bg-gradient-to-r from-[#40f] to-[#ff00d9] text-primary-foreground border-0 hover:brightness-110 transition-all">
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
