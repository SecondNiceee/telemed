import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import { ApiCategory, getErrorMessage } from "../lib/api/index";
import { fetchCategoriesLocal } from "../lib/api/categories.server";
import { CategoryIcon } from "@/lib/utils/categoryIcon";
import { SearchBar } from "@/components/search-bar";

export async function CategoriesSection() {
  let categories: ApiCategory[] = [];
  let error: string | null = null;

  try {
    categories = await fetchCategoriesLocal();
  } catch (err) {
    error = getErrorMessage(err);
  }

  if (error) {
    return (
      <section id="categories" className="py-6 sm:py-8 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-destructive">{error}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="categories" className="py-6 sm:py-8 bg-background relative overflow-hidden">
      {/* Animated background gradient */}
      <div 
        className="absolute inset-0 opacity-50"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 50% 0%, oklch(0.52 0.28 300 / 0.08), transparent)",
        }}
        aria-hidden="true"
      />
      
      {/* Grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(to right, oklch(0.52 0.28 300 / 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, oklch(0.52 0.28 300 / 0.05) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
          maskImage: "radial-gradient(ellipse 60% 60% at 50% 50%, black 20%, transparent 100%)",
        }}
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-8">
          <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold tracking-[0.15em] uppercase text-primary border border-primary/20 bg-primary/5 backdrop-blur-sm mb-4 shadow-sm shadow-primary/10">
            Специалисты
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-3">
            Выберите специалиста
          </h2>
          <p className="text-muted-foreground text-lg sm:text-xl max-w-2xl mx-auto mb-6">
            Найдите нужного врача по специальности и запишитесь на удобное время
          </p>
          
          {/* Search Bar */}
          <SearchBar />
        </div>

        {categories.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((category, index) => (
              <Link key={category.id} href={`/category/${category.slug}`}>
                <Card 
                  className="group h-full py-0 border-border/50 bg-card/70 backdrop-blur-sm hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 hover:border-primary/40 cursor-pointer hover:-translate-y-2"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-5">
                      <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/15 via-primary/10 to-primary/5 flex items-center justify-center shrink-0 group-hover:from-primary/25 group-hover:to-primary/10 transition-all duration-300 shadow-lg shadow-primary/10 group-hover:scale-110">
                        <CategoryIcon category={category} className="w-8 h-8 text-primary" />
                        {/* Glow effect */}
                        <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl opacity-0 group-hover:opacity-50 transition-opacity" />
                      </div>
                      <div className="flex-1 min-w-0 pt-1">
                        <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                          {category.name}
                        </h3>
                        {category.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-2 leading-relaxed">
                            {category.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-end mt-5 pt-4 border-t border-border/40">
                      <span className="text-sm font-medium text-primary/80 group-hover:text-primary transition-colors flex items-center gap-2">
                        Подробнее
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform duration-300" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🔍</span>
            </div>
            <p className="text-muted-foreground text-lg">Категории пока не добавлены</p>
          </div>
        )}
      </div>
    </section>
  );
}
