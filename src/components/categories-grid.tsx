"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { ApiCategory } from "@/lib/api/types";
import { CategoryIcon } from "@/lib/utils/categoryIcon";

/** Сколько карточек категорий показываем на одной странице */
const CATEGORIES_PER_PAGE = 9;

/**
 * Формирует список страниц с многоточиями:
 * 1 ... 4 5 6 ... 12
 */
function buildPageItems(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages = new Set<number>([1, total, current]);
  if (current - 1 > 1) pages.add(current - 1);
  if (current + 1 < total) pages.add(current + 1);

  // Держим на краях чуть больше номеров, чтобы блок не «прыгал» по ширине
  if (current <= 3) {
    pages.add(2).add(3).add(4);
  }
  if (current >= total - 2) {
    pages.add(total - 1).add(total - 2).add(total - 3);
  }

  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  const items: (number | "ellipsis")[] = [];
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) {
      items.push("ellipsis");
    }
    items.push(page);
  });

  return items;
}

export function CategoriesGrid({ categories }: { categories: ApiCategory[] }) {
  const [page, setPage] = useState(1);
  const gridRef = useRef<HTMLDivElement>(null);

  const totalPages = Math.max(1, Math.ceil(categories.length / CATEGORIES_PER_PAGE));
  const currentPage = Math.min(page, totalPages);

  const visibleCategories = useMemo(() => {
    const start = (currentPage - 1) * CATEGORIES_PER_PAGE;
    return categories.slice(start, start + CATEGORIES_PER_PAGE);
  }, [categories, currentPage]);

  const pageItems = useMemo(
    () => buildPageItems(currentPage, totalPages),
    [currentPage, totalPages],
  );

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

      {totalPages > 1 && (
        <nav
          aria-label="Пагинация по категориям"
          className="mt-10 flex flex-col items-center gap-4"
        >
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              aria-label="Предыдущая страница"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <div className="flex items-center gap-1">
              {pageItems.map((item, index) =>
                item === "ellipsis" ? (
                  <span
                    key={`ellipsis-${index}`}
                    aria-hidden="true"
                    className="w-9 text-center text-muted-foreground select-none"
                  >
                    &hellip;
                  </span>
                ) : (
                  <Button
                    key={item}
                    variant={item === currentPage ? "default" : "ghost"}
                    size="icon"
                    onClick={() => goToPage(item)}
                    aria-label={`Страница ${item}`}
                    aria-current={item === currentPage ? "page" : undefined}
                    className="tabular-nums"
                  >
                    {item}
                  </Button>
                ),
              )}
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              aria-label="Следующая страница"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <p className="text-sm text-muted-foreground" aria-live="polite">
            {rangeStart}&ndash;{rangeEnd} из {categories.length} специальностей
          </p>
        </nav>
      )}
    </div>
  );
}
