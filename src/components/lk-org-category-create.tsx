"use client"

import React, { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CategoriesApi } from "@/lib/api/categories"
import { revalidateCategoriesAction } from "@/lib/api/actions"
import {
  ArrowLeft,
  Tag,
  CheckCircle,
  AlertCircle,
  Loader2,
  X,
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

function transliterate(text: string): string {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh",
    з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
    п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts",
    ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu",
    я: "ya",
  }
  return text
    .toLowerCase()
    .split("")
    .map((char) => map[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function LkOrgCategoryCreate() {
  const router = useRouter()
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { isSubmitting, errors },
  } = useForm<CategoryFormValues>({ defaultValues })

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const name = e.target.value
    setValue("name", name)
    setValue("slug", transliterate(name))
  }

  async function onSubmit(data: CategoryFormValues) {
    setError(null)
    setSuccess(null)

    try {
      const payload: { name: string; slug: string; description?: string; icon?: string } = {
        name: data.name.trim(),
        slug: data.slug.trim(),
      }
      if (data.description.trim()) payload.description = data.description.trim()
      if (data.icon.trim()) payload.icon = data.icon.trim()

      await CategoriesApi.create(payload)
      await revalidateCategoriesAction()

      setSuccess(`Специализация "${data.name}" успешно создана!`)
      reset(defaultValues)

      setTimeout(() => {
        router.push("/lk-org/categories")
        router.refresh()
      }, 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Произошла ошибка")
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
          Назад к специализациям
        </Link>

        {/* Form card */}
        <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Tag className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                Создать специализацию
              </h1>
              <p className="text-sm text-muted-foreground">
                Добавьте новую специализацию для врачей
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

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cat-name">Название *</Label>
              <Input
                id="cat-name"
                placeholder="Кардиолог"
                aria-invalid={!!errors.name}
                {...register("name", { required: "Обязательное поле" })}
                onChange={handleNameChange}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="cat-slug">Слаг (URL) *</Label>
              <Input
                id="cat-slug"
                placeholder="kardiolog"
                aria-invalid={!!errors.slug}
                {...register("slug", { required: "Обязательное поле" })}
              />
              <p className="text-xs text-muted-foreground">
                Генерируется автоматически из названия. Можно изменить вручную.
              </p>
              {errors.slug && (
                <p className="text-sm text-destructive">{errors.slug.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="cat-description">Описание</Label>
              <Input
                id="cat-description"
                placeholder="Специалист по заболеваниям сердца"
                {...register("description")}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="cat-icon">Иконка (Lucide)</Label>
              <Input
                id="cat-icon"
                placeholder="heart, stethoscope, brain..."
                {...register("icon")}
              />
              <p className="text-xs text-muted-foreground">
                Название иконки из библиотеки Lucide
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={isSubmitting} className="gap-2">
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Создание...
                  </>
                ) : (
                  "Создать специализацию"
                )}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/lk-org/categories">Отмена</Link>
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
