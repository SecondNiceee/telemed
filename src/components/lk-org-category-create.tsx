"use client"

import React, { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { useCategoriesStore } from "@/stores/categories-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Loader2,
  CheckCircle,
  AlertCircle,
  X,
  ArrowLeft,
  Plus,
} from "lucide-react"

interface CategoryFormValues {
  name: string
  slug: string
  description: string
  icon: string
}

const defaultValues: CategoryFormValues = {
  name: "",
  slug: "",
  description: "",
  icon: "",
}

export function LkOrgCategoryCreate() {
  const router = useRouter()
  const { createCategory } = useCategoriesStore()
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { isSubmitting, errors },
  } = useForm<CategoryFormValues>({ defaultValues })

  const nameValue = watch("name")

  const onSubmit = async (data: CategoryFormValues) => {
    setError(null)
    setSuccess(null)

    try {
      // Generate slug from name if not provided
      const slug = data.slug || nameValue.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "")

      if (!slug) {
        throw new Error("Не удалось сгенерировать слаг. Укажите название специальности")
      }

      await createCategory({
        name: data.name,
        slug,
        description: data.description || undefined,
        icon: data.icon || undefined,
      })

      setSuccess(`Специальность "${data.name}" успешно создана!`)
      reset(defaultValues)

      // Redirect back to categories list after short delay
      setTimeout(() => {
        router.replace("/lk-org/categories")
        router.refresh()
      }, 1500)
    } catch (err) {
      console.error("[lk-org] Category creation error:", err)
      setError(err instanceof Error ? err.message : "Произошла ошибка при создании специальности")
    }
  }

  return (
    <div className="flex-1">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back link */}
        <Link
          href="/lk-org/categories"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад к специальностям
        </Link>

        {/* Form card */}
        <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Plus className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                Создать специальность
              </h1>
              <p className="text-sm text-muted-foreground">
                Добавьте новую специальность врачей
              </p>
            </div>
          </div>

          {/* Success message */}
          {success && (
            <div className="flex items-center gap-3 rounded-lg bg-green-500/10 border border-green-500/20 p-4 mb-6">
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
              <p className="text-sm text-green-500 font-medium">{success}</p>
              <button
                type="button"
                onClick={() => setSuccess(null)}
                className="ml-auto p-1 rounded hover:bg-green-500/10 transition-colors"
              >
                <X className="w-4 h-4 text-green-500" />
              </button>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-3 rounded-lg bg-destructive/10 border border-destructive/20 p-4 mb-6">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
              <p className="text-sm text-destructive font-medium">{error}</p>
              <button
                type="button"
                onClick={() => setError(null)}
                className="ml-auto p-1 rounded hover:bg-destructive/10 transition-colors"
              >
                <X className="w-4 h-4 text-destructive" />
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
            {/* Name field */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="category-name">Название специальности *</Label>
              <Input
                id="category-name"
                placeholder="Например: Терапевт, Кардиолог, Невролог"
                aria-invalid={!!errors.name}
                {...register("name", {
                  required: "Обязательное поле",
                  minLength: { value: 2, message: "Минимум 2 символа" },
                })}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            {/* Slug field */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="category-slug">
                URL слаг{" "}
                <span className="text-muted-foreground font-normal">
                  (опционально, генерируется автоматически)
                </span>
              </Label>
              <Input
                id="category-slug"
                placeholder="therapist, cardiologist"
                {...register("slug")}
              />
              <p className="text-xs text-muted-foreground">
                Уникальный идентификатор для URL. Если оставить пусто, будет сгенерирован из названия.
              </p>
            </div>

            {/* Description field */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="category-description">
                Описание{" "}
                <span className="text-muted-foreground font-normal">
                  (опционально)
                </span>
              </Label>
              <textarea
                id="category-description"
                rows={3}
                placeholder="Добавьте описание этой специальности..."
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-medium text-foreground
                  placeholder:text-muted-foreground placeholder:font-normal focus-visible:outline-none
                  focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50
                  resize-y min-h-[100px]"
                {...register("description")}
              />
            </div>

            {/* Icon field */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="category-icon">
                Иконка Lucide{" "}
                <span className="text-muted-foreground font-normal">
                  (опционально)
                </span>
              </Label>
              <Input
                id="category-icon"
                placeholder="Например: stethoscope, heart, brain"
                {...register("icon")}
              />
              <p className="text-xs text-muted-foreground">
                Название иконки из библиотеки Lucide для отображения (например: stethoscope, heart, brain, pills, activity)
              </p>
            </div>

            {/* Submit button */}
            <div className="flex items-center gap-3 pt-4">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin" />
                    <span>Создание...</span>
                  </>
                ) : (
                  "Создать специальность"
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
