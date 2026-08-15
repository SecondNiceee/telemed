"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Формирует список страниц с многоточиями:
 * 1 ... 4 5 6 ... 12
 */
export function buildPageItems(current: number, total: number): (number | "ellipsis")[] {
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

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Подпись под кнопками, например «1–6 из 23 врачей» */
  label?: string;
  /** Значение aria-label для навигации */
  ariaLabel?: string;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  label,
  ariaLabel = "Пагинация",
  className = "mt-10 flex flex-col items-center gap-4",
}: PaginationProps) {
  const pageItems = useMemo(
    () => buildPageItems(currentPage, totalPages),
    [currentPage, totalPages],
  );

  if (totalPages <= 1) return null;

  return (
    <nav aria-label={ariaLabel} className={className}>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(currentPage - 1)}
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
                onClick={() => onPageChange(item)}
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
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Следующая страница"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {label && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {label}
        </p>
      )}
    </nav>
  );
}
