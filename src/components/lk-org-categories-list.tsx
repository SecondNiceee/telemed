"use client"

import React, { useEffect } from "react"
import Link from "next/link"
import { useCategoriesStore } from "@/stores/categories-store"
import {
  Plus,
  Stethoscope,
  ChevronRight,
  Loader2,
  ArrowLeft,
} from "lucide-react"
import { Button } from "@/components/ui/button"

export function LkOrgCategoriesList() {
  const { categories, loading, fetched, fetchCategories } = useCategoriesStore()

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  return (
    <div className="flex-1">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back button */}
        <div className="mb-6">
          <Button asChild variant="ghost" size="sm" className="gap-2">
            <Link href="/lk-org">
              <ArrowLeft className="w-4 h-4" />
              <span>Назад</span>
            </Link>
          </Button>
        </div>

        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground text-balance">
              Специальности врачей
            </h1>
            <p className="text-muted-foreground mt-1">
              Управление категориями и специализациями
            </p>
          </div>
          <Button asChild className="gap-2">
            <Link href="/lk-org/categories/create">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Создать специальность</span>
            </Link>
          </Button>
        </div>

        {/* Categories list */}
        {loading && !fetched ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Загрузка специальностей...</p>
            </div>
          </div>
        ) : categories.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
              <Stethoscope className="w-8 h-8 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-foreground font-medium">
                Нет специальностей
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Создайте первую специальность для своей организации
              </p>
            </div>
            <Button asChild className="gap-2">
              <Link href="/lk-org/categories/create">
                <Plus className="w-4 h-4" />
                Создать специальность
              </Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {categories.map((category) => (
              <div
                key={category.id}
                className="rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-md transition-all p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Stethoscope className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-foreground">
                          {category.name}
                        </h3>
                        {category.description && (
                          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                            {category.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 ml-4" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
