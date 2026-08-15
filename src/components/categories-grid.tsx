"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { ArrowRight } from "lucide-react";
import type { ApiCategory } from "@/lib/api/types";
import { CategoryIcon } from "@/lib/utils/categoryIcon";

/** Сколько карточек категорий показываем на одной странице */
const CATEGORIES_PER_PAGE = 6;

export function CategoriesGrid({ categories }: { categories: ApiCategory[] }) {
  const [page, setPage] = useState(1);
  const gridRef = useRef<HTMLDivElement>(null);

  const totalPages = Math.max(1, Math.ceil(categories.length / CATEGORIES_PER_PAGE));
  const currentPage = Math.min(page, totalPages);

  // Если список категорий изменился и страниц стало меньше — не оставляем «мёртвую» страницу в state
  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const visibleCategories = useMemo(() => {
    const start = (currentPage - 1) * CATEGORIES_PER_PAGE;
    return categories.slice(start, start + CATEGORIES_PER_PAGE);
  }, [categories, currentPage]);

  const goToPage = (next: number) => {
    const clamped = Math.min(Math.max(1, next), totalPages);
    if (clamped === currentPage) return;
    setPage(clamped);
    // Возвращаем пользователя к началу списка, чтобы он не оказался в середине сетки
    gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const rangeStart = (currentPage - 1) * CATEGORIES_PER_PAGE + 1;
  const rangeEnd = rangeStart + visibleCategories.length - 1;

  return (
    <div>
      <div ref={gridRef} className="scroll-mt-28">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleCategories.map((category, index) => (
            <Link key={category.id} href={`/category/${category.slug}`}>
              <Card
                className="sc-card group h-full py-0 border-0 bg-card cursor-pointer"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-5">
                    <div className="w-14 h-14 rounded-xl bg-teal/10 flex items-center justify-center shrink-0 group-hover:bg-teal transition-colors duration-300">
                      <CategoryIcon
                        category={category}
                        className="w-7 h-7 text-teal group-hover:text-teal-foreground transition-colors duration-300"
                      />
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
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={goToPage}
        ariaLabel="Пагинация по категориям"
        label={`${rangeStart}–${rangeEnd} из ${categories.length} специальностей`}
      />
    </div>
  );
}
