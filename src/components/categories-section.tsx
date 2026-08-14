import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Search } from "lucide-react";
import { ApiCategory, getErrorMessage } from "../lib/api/index";
import { fetchCategoriesLocal } from "../lib/api/categories.server";
import { CategoryIcon } from "@/lib/utils/categoryIcon";
import { SearchBar } from "@/components/search-bar";
import { SectionBadge } from "@/components/section-badge";

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-8">
          <SectionBadge tone="teal" className="mb-4">
            Специалисты
          </SectionBadge>
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
                  className="sc-card group h-full py-0 border-0 bg-card cursor-pointer"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-5">
                      <div className="w-14 h-14 rounded-xl bg-teal/10 flex items-center justify-center shrink-0 group-hover:bg-teal transition-colors duration-300">
                        <CategoryIcon category={category} className="w-7 h-7 text-teal group-hover:text-teal-foreground transition-colors duration-300" />
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
                      <span className="text-sm font-medium text-teal group-hover:text-primary transition-colors flex items-center gap-2">
                        Подробнее
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-teal/10 group-hover:bg-teal transition-colors duration-300">
                          <ArrowRight className="w-3.5 h-3.5 text-teal group-hover:text-teal-foreground transition-colors duration-300" />
                        </span>
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
              <Search className="w-8 h-8 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="text-muted-foreground text-lg">Категории пока не добавлены</p>
          </div>
        )}
      </div>
    </section>
  );
}
