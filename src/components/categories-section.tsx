import { Search } from "lucide-react";
import { ApiCategory, getErrorMessage } from "../lib/api/index";
import { fetchCategoriesLocal } from "../lib/api/categories.server";
import { CategoriesGrid } from "@/components/categories-grid";
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
          <SearchBar categories={categories} />
        </div>

        {categories.length > 0 ? (
          <CategoriesGrid categories={categories} />
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
