"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowRight, Search, X } from "lucide-react";
import type { ApiCategory } from "@/lib/api/types";
import { CategoryIcon } from "@/lib/utils/categoryIcon";
import { BackButton } from "@/components/back-button";

interface AppointmentPageClientProps {
  initialCategories: ApiCategory[];
}

export function AppointmentPageClient({ initialCategories }: AppointmentPageClientProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Filter categories by search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return initialCategories;

    const query = searchQuery.toLowerCase();
    return initialCategories.filter(
      (category) =>
        category.name.toLowerCase().includes(query) ||
        (category.description && category.description.toLowerCase().includes(query)),
    );
  }, [initialCategories, searchQuery]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <BackButton fallbackHref="/" className="mb-4" />

        <div className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground text-balance">
            Записаться на консультацию
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
            Выберите специальность врача и удобное время
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-teal" />
          <Input
            type="text"
            placeholder="Поиск по категориям..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-12 rounded-full border-teal/30 bg-card/80 focus-visible:border-teal focus-visible:ring-teal/20"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              aria-label="Очистить поиск"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-teal hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Categories List */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Специальности{" "}
          <span className="inline-flex items-center rounded-full bg-teal/10 px-2.5 py-0.5 text-sm font-semibold text-teal">
            {filteredCategories.length}
          </span>
        </h2>

        {filteredCategories.length > 0 ? (
          // grid+gap вместо space-y: карточки обёрнуты в Link (<a> — инлайновый
          // элемент), на котором вертикальные margin от space-y не срабатывали,
          // поэтому отступов между специальностями не было видно.
          <div className="grid gap-4">
            {filteredCategories.map((category) => (
              <Link key={category.id} href={`/category/${category.slug}`} className="block">
                <Card className="group py-0 border-teal/20 bg-card/80 hover:shadow-lg hover:shadow-teal/10 transition-all duration-300 hover:border-teal/50 cursor-pointer hover:-translate-y-0.5">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal/20 to-teal/5 flex items-center justify-center shrink-0 group-hover:from-teal/30 group-hover:to-teal/10 transition-all duration-300 shadow-sm">
                        <CategoryIcon category={category} className="w-6 h-6 text-teal" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-foreground group-hover:text-teal transition-colors">
                          {category.name}
                        </h3>
                        {category.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                            {category.description}
                          </p>
                        )}
                      </div>
                      <ArrowRight className="w-5 h-5 text-teal/60 group-hover:text-teal group-hover:translate-x-1 transition-all shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 rounded-2xl border border-teal/20 bg-teal/[0.04]">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal/10">
              <Search className="h-7 w-7 text-teal" aria-hidden="true" />
            </div>
            <p className="text-muted-foreground text-lg">
              {searchQuery
                ? "Категории не найдены по вашему запросу"
                : "Категории пока не добавлены"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
