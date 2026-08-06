"use client"

import React, { useState, useRef, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { useCategoriesStore } from "@/stores/categories-store"
import { CategoriesApi } from "@/lib/api/categories"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Loader2,
  CheckCircle,
  AlertCircle,
  X,
  ArrowLeft,
  Pencil,
  Upload,
  ImageIcon,
  Stethoscope,
  Heart,
  Brain,
  Eye,
  Ear,
  Bone,
  Baby,
  Smile,
  Activity,
  Thermometer,
  Shield,
  Syringe,
  Pill,
  Microscope,
  HeartPulse,
  Dna,
  FlaskConical,
  Radiation,
  Scissors,
  Bandage,
  Plus as CrossIcon,
  HandHeart,
  Wind,
  PersonStanding,
  UserRound,
  Bed,
  ClipboardList,
  Search,
  Trash2,
} from "lucide-react"

// Medical Lucide icons with their names
const MEDICAL_ICONS = [
  { name: "stethoscope", label: "Стетоскоп", Icon: Stethoscope },
  { name: "heart", label: "Сердце", Icon: Heart },
  { name: "heart-pulse", label: "Пульс", Icon: HeartPulse },
  { name: "brain", label: "Мозг", Icon: Brain },
  { name: "eye", label: "Глаз", Icon: Eye },
  { name: "ear", label: "Ухо", Icon: Ear },
  { name: "bone", label: "Кость", Icon: Bone },
  { name: "baby", label: "Ребёнок", Icon: Baby },
  { name: "smile", label: "Зубы", Icon: Smile },
  { name: "activity", label: "Активность", Icon: Activity },
  { name: "thermometer", label: "Термометр", Icon: Thermometer },
  { name: "shield", label: "Иммунитет", Icon: Shield },
  { name: "syringe", label: "Укол", Icon: Syringe },
  { name: "pill", label: "Таблетка", Icon: Pill },
  { name: "microscope", label: "Микроскоп", Icon: Microscope },
  { name: "dna", label: "ДНК", Icon: Dna },
  { name: "flask-conical", label: "Колба", Icon: FlaskConical },
  { name: "radiation", label: "Радиология", Icon: Radiation },
  { name: "scissors", label: "Хирургия", Icon: Scissors },
  { name: "bandage", label: "Перевязка", Icon: Bandage },
  { name: "cross", label: "Крест", Icon: CrossIcon },
  { name: "hand-heart", label: "Забота", Icon: HandHeart },
  { name: "wind", label: "Лёгкие", Icon: Wind },
  { name: "person-standing", label: "Ортопед", Icon: PersonStanding },
  { name: "user-round", label: "Врач", Icon: UserRound },
  { name: "bed", label: "Стационар", Icon: Bed },
  { name: "clipboard-list", label: "Анализы", Icon: ClipboardList },
]

interface CategoryFormValues {
  name: string
  slug: string
  description: string
}

interface LkOrgCategoryEditProps {
  categoryId: number
}

export function LkOrgCategoryEdit({ categoryId }: LkOrgCategoryEditProps) {
  const router = useRouter()
  const { updateCategory, deleteCategory, refetchCategories } = useCategoriesStore()
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingCategory, setLoadingCategory] = useState(true)
  const [deleting, setDeleting] = useState(false)

  // Icon picker state
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null)
  const [iconSearch, setIconSearch] = useState("")

  // Image upload state
  const [uploadMode, setUploadMode] = useState<"lucide" | "image">("lucide")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<CategoryFormValues>()

  const filteredIcons = MEDICAL_ICONS.filter(
    (i) =>
      i.label.toLowerCase().includes(iconSearch.toLowerCase()) ||
      i.name.toLowerCase().includes(iconSearch.toLowerCase()),
  )

  // Load category data
  useEffect(() => {
    async function loadCategory() {
      try {
        const category = await CategoriesApi.fetchById(categoryId)
        reset({
          name: category.name,
          slug: category.slug,
          description: category.description || "",
        })
        if (category.icon) {
          setSelectedIcon(category.icon)
          setUploadMode("lucide")
        }
        if (category.iconImage && typeof category.iconImage === "object") {
          setExistingImageUrl(category.iconImage.url || null)
          setUploadMode("image")
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить категорию")
      } finally {
        setLoadingCategory(false)
      }
    }
    loadCategory()
  }, [categoryId, reset])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setExistingImageUrl(null)
  }

  const handleRemoveImage = () => {
    setImageFile(null)
    setImagePreview(null)
    setExistingImageUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const onSubmit = async (data: CategoryFormValues) => {
    setError(null)
    setSuccess(null)

    try {
      let iconImageId: number | undefined

      if (uploadMode === "image" && imageFile) {
        setUploadingImage(true)
        try {
          const uploaded = await CategoriesApi.uploadMedia(imageFile)
          iconImageId = uploaded.id
        } finally {
          setUploadingImage(false)
        }
      }

      await updateCategory(categoryId, {
        name: data.name,
        slug: data.slug,
        description: data.description || undefined,
        icon: uploadMode === "lucide" ? (selectedIcon ?? undefined) : undefined,
        iconImage: iconImageId,
      })

      setSuccess(`Специальность "${data.name}" успешно обновлена!`)

      setTimeout(() => {
        router.replace("/lk-org/categories")
        router.refresh()
      }, 1500)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Произошла ошибка при обновлении специальности",
      )
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)
    try {
      await deleteCategory(categoryId)
      await refetchCategories()
      router.replace("/lk-org/categories")
      router.refresh()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Произошла ошибка при удалении специальности",
      )
      setDeleting(false)
    }
  }

  const isBusy = isSubmitting || uploadingImage || deleting

  if (loadingCategory) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Загрузка категории...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/lk-org/categories"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад к специальностям
        </Link>

        <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Pencil className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">Редактировать специальность</h1>
                <p className="text-sm text-muted-foreground">Измените данные специальности</p>
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Удалить</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Удалить специальность?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Это действие нельзя отменить. Специальность будет удалена навсегда.
                    Если к этой специальности привязаны врачи, удаление будет невозможно.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Отмена</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Удаление...
                      </>
                    ) : (
                      "Удалить"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

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
            {/* Name */}
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

            {/* Slug */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="category-slug">URL слаг *</Label>
              <Input
                id="category-slug"
                placeholder="therapist, cardiologist"
                {...register("slug", {
                  required: "Обязательное поле",
                })}
              />
              <p className="text-xs text-muted-foreground">
                Уникальный идентификатор для URL
              </p>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="category-description">
                Описание{" "}
                <span className="text-muted-foreground font-normal">(опционально)</span>
              </Label>
              <textarea
                id="category-description"
                rows={3}
                placeholder="Добавьте описание этой специальности..."
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-medium text-foreground
                  placeholder:text-muted-foreground placeholder:font-normal focus-visible:outline-none
                  focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50
                  resize-y min-h-[80px]"
                {...register("description")}
              />
            </div>

            {/* Icon section */}
            <div className="flex flex-col gap-3">
              <Label>Иконка</Label>

              {/* Mode toggle */}
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setUploadMode("lucide")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors ${
                    uploadMode === "lucide"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Stethoscope className="w-4 h-4" />
                  Lucide иконка
                </button>
                <button
                  type="button"
                  onClick={() => setUploadMode("image")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors ${
                    uploadMode === "image"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <ImageIcon className="w-4 h-4" />
                  Загрузить
                </button>
              </div>

              {uploadMode === "lucide" && (
                <div className="flex flex-col gap-3">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Поиск иконки..."
                      className="pl-9"
                      value={iconSearch}
                      onChange={(e) => setIconSearch(e.target.value)}
                    />
                  </div>

                  {/* Icon grid */}
                  <div className="grid grid-cols-6 sm:grid-cols-9 gap-1.5 max-h-52 overflow-y-auto rounded-lg border border-border p-2">
                    {filteredIcons.map(({ name, label, Icon }) => (
                      <button
                        key={name}
                        type="button"
                        title={label}
                        onClick={() =>
                          setSelectedIcon(selectedIcon === name ? null : name)
                        }
                        className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg transition-colors ${
                          selectedIcon === name
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted text-muted-foreground"
                        }`}
                      >
                        <Icon className="w-5 h-5 shrink-0" />
                        <span className="text-[9px] leading-tight text-center line-clamp-1 w-full">
                          {label}
                        </span>
                      </button>
                    ))}
                    {filteredIcons.length === 0 && (
                      <div className="col-span-full py-6 text-center text-sm text-muted-foreground">
                        Ничего не найдено
                      </div>
                    )}
                  </div>

                  {selectedIcon && (
                    <p className="text-xs text-muted-foreground">
                      Выбрано: <span className="font-medium text-foreground">{selectedIcon}</span>
                    </p>
                  )}
                </div>
              )}

              {uploadMode === "image" && (
                <div className="flex flex-col gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  {imagePreview || existingImageUrl ? (
                    <div className="flex items-center gap-4">
                      <div className="relative w-16 h-16 rounded-xl border border-border overflow-hidden shrink-0">
                        <Image
                          src={imagePreview || existingImageUrl || ""}
                          alt="Предпросмотр иконки"
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <p className="text-sm text-foreground font-medium">
                          {imageFile?.name || "Текущее изображение"}
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-2 w-fit"
                          onClick={handleRemoveImage}
                        >
                          <X className="w-3.5 h-3.5" />
                          Удалить
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 p-8 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <Upload className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-foreground">
                          Нажмите для выбора файла
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          PNG, JPG, SVG до 5 МБ
                        </p>
                      </div>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Submit */}
            <div className="pt-2">
              <Button type="submit" disabled={isBusy} className="w-full">
                {isBusy ? (
                  <>
                    <Loader2 className="animate-spin" />
                    <span>{uploadingImage ? "Загрузка файла..." : "Сохранение..."}</span>
                  </>
                ) : (
                  "Сохранить изменения"
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
