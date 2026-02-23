"use client"

import Link from "next/link"
import type { ApiCategory } from "@/lib/api/types"
import {
  ArrowLeft,
  Plus,
  Tag,
  Stethoscope,
} from "lucide-react"
import { Button } from "@/components/ui/button"

interface LkOrgCategoriesProps {
  initialCategories: ApiCategory[]
}

export function LkOrgCategories({ initialCategories }: LkOrgCategoriesProps) {
  return (
    <div className="flex-1">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back link */}
        <Link
          href="/lk-org"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад к кабинету
        </Link>

        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Tag className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground text-balance">
                Специализации
              </h1>
              <p className="text-sm text-muted-foreground">
                {initialCategories.length === 0
                  ? "Пока нет специализаций"
                  : `${initialCategories.length} ${
                      initialCategories.length === 1
                        ? "специализация"
                        : initialCategories.length < 5
                          ? "специализации"
                          : "специализаций"
                    }`}
              </p>
            </div>
          </div>
          <Button asChild className="gap-2">
            <Link href="/lk-org/categories/create">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Создать</span>
            </Link>
          </Button>
        </div>

        {/* Categories list */}
        {initialCategories.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
              <Stethoscope className="w-8 h-8 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-foreground font-medium">
                Нет специализаций
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Добавьте первую специализацию для врачей
              </p>
            </div>
            <Button asChild className="gap-2">
              <Link href="/lk-org/categories/create">
                <Plus className="w-4 h-4" />
                Создать специализацию
              </Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {initialCategories.map((category) => (
              <div
                key={category.id}
                className="rounded-xl border border-border bg-card p-4 flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Stethoscope className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-foreground truncate">
                    {category.name}
                  </h3>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-muted-foreground font-mono">
                      {category.slug}
                    </span>
                    {category.description && (
                      <span className="text-xs text-muted-foreground truncate">
                        {category.description}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
