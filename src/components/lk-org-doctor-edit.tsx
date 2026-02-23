"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray, Controller } from "react-hook-form"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getBasePath } from "@/lib/utils/basePath"
import { fetchCategoriesAction, revalidateDoctorsAction } from "@/lib/api/actions"
import { DoctorsApi } from "@/lib/api/doctors"
import type { ApiCategory, ApiDoctor } from "@/lib/api/types"
import {
  Plus,
  Trash2,
  Upload,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowLeft,
  X,
} from "lucide-react"

interface DoctorFormValues {
  name: string
  email: string
  password?: string
  categories: number[]
  experience: string
  degree: string
  price: string
  bio: string
  education: { value: string }[]
  services: { value: string }[]
}

interface LkOrgDoctorEditProps {
  doctorId: number
  orgId: number
}

export function LkOrgDoctorEdit({ doctorId, orgId }: LkOrgDoctorEditProps) {
  const router = useRouter()
  const [doctor, setDoctor] = useState<ApiDoctor | null>(null)
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [categories, setCategories] = useState<ApiCategory[]>([])
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const basePath = getBasePath()

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isSubmitting, errors },
  } = useForm<DoctorFormValues>({ 
    defaultValues: {
      name: "",
      email: "",
      password: "",
      categories: [],
      experience: "",
      degree: "",
      price: "",
      bio: "",
      education: [{ value: "" }],
      services: [{ value: "" }],
    }
  })

  const {
    fields: educationFields,
    append: appendEducation,
    remove: removeEducation,
  } = useFieldArray({ control, name: "education" })

  const {
    fields: serviceFields,
    append: appendService,
    remove: removeService,
  } = useFieldArray({ control, name: "services" })

  const selectedCategories = watch("categories")

  // Load doctor and categories data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [doctorData, categoriesData] = await Promise.all([
          DoctorsApi.fetchById(doctorId),
          fetchCategoriesAction(),
        ])

        setDoctor(doctorData)
        setCategories(categoriesData)

        // Populate form with doctor data
        const categoryIds = (doctorData.categories || [])
          .map((cat) => (typeof cat === 'number' ? cat : cat.id))
          .filter((id): id is number => id != null)

        const educationList = DoctorsApi.getEducation(doctorData)
        const servicesList = DoctorsApi.getServices(doctorData)

        reset({
          name: doctorData.name || "",
          email: doctorData.email || "",
          password: "",
          categories: categoryIds,
          experience: doctorData.experience?.toString() || "",
          degree: doctorData.degree || "",
          price: doctorData.price?.toString() || "",
          bio: doctorData.bio || "",
          education: educationList.length > 0 
            ? educationList.map(v => ({ value: v }))
            : [{ value: "" }],
          services: servicesList.length > 0
            ? servicesList.map(v => ({ value: v }))
            : [{ value: "" }],
        })

        // Set photo preview
        if (doctorData.photo && typeof doctorData.photo === 'object' && 'url' in doctorData.photo) {
          setPhotoPreview(doctorData.photo.url as string)
        }
      } catch (err) {
        console.error("[lk-org] Failed to load doctor:", err)
        setError("Не удалось загрузить данные врача")
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [doctorId, reset])

  const toggleCategory = useCallback(
    (id: number) => {
      const current = selectedCategories
      if (current.includes(id)) {
        setValue(
          "categories",
          current.filter((c) => c !== id),
        )
      } else {
        setValue("categories", [...current, id])
      }
    },
    [selectedCategories, setValue],
  )

  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPhoto(file)
      const preview = URL.createObjectURL(file)
      setPhotoPreview(preview)
    }
  }

  const onSubmit = async (data: DoctorFormValues) => {
    setError(null)
    setSuccess(null)

    try {
      const formData = new FormData()

      // Add fields
      formData.append("name", data.name)
      formData.append("email", data.email)
      if (data.password) {
        formData.append("password", data.password)
      }
      formData.append("experience", data.experience ? parseInt(data.experience) : "")
      formData.append("degree", data.degree)
      formData.append("price", data.price ? parseInt(data.price) : "")
      formData.append("bio", data.bio)

      // Add categories as JSON
      formData.append("categories", JSON.stringify(data.categories))

      // Add education as JSON
      const educationList = data.education
        .map((e) => e.value)
        .filter(Boolean)
      formData.append("education", JSON.stringify(educationList.map(v => ({ value: v }))))

      // Add services as JSON
      const servicesList = data.services
        .map((s) => s.value)
        .filter(Boolean)
      formData.append("services", JSON.stringify(servicesList.map(v => ({ value: v }))))

      // Add photo if selected
      if (photo) {
        formData.append("photo", photo)
      }

      const response = await fetch(`${basePath}/api/doctors/${doctorId}`, {
        method: "PATCH",
        credentials: "include",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          errorData.message || `HTTP ${response.status}`,
        )
      }

      const updatedDoctor = await response.json()

      setSuccess(`Врач "${data.name}" успешно обновлен!`)
      setDoctor(updatedDoctor)

      // Revalidate cache
      await revalidateDoctorsAction()

      // Redirect back to main page after short delay
      setTimeout(() => {
        router.push("/lk-org")
        router.refresh()
      }, 1500)
    } catch (err) {
      console.error("[lk-org] Doctor update error:", err)
      setError(err instanceof Error ? err.message : "Произошла ошибка при обновлении врача")
    }
  }

  if (isLoading) {
    return (
      <div className="flex-1">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        </div>
      </div>
    )
  }

  if (!doctor) {
    return (
      <div className="flex-1">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Врач не найден</h2>
            <Button asChild>
              <Link href="/lk-org">Вернуться в кабинет</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Редактирование врача
          </h1>
          <p className="text-muted-foreground">
            Обновите информацию о враче
          </p>
        </div>

        {/* Success message */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-green-900">{success}</p>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-red-900">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Basic Info Section */}
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">
                Основная информация
              </h2>

              {/* Name */}
              <div className="mb-4">
                <Label htmlFor="name" className="text-sm font-medium text-foreground">
                  Имя врача
                </Label>
                <Input
                  id="name"
                  placeholder="Иван Иванов"
                  className={cn(
                    "mt-2",
                    errors.name && "border-red-500 focus-visible:ring-red-500",
                  )}
                  {...register("name", {
                    required: "Имя обязательно",
                  })}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
                )}
              </div>

              {/* Email */}
              <div className="mb-4">
                <Label htmlFor="email" className="text-sm font-medium text-foreground">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="doctor@example.com"
                  className={cn(
                    "mt-2",
                    errors.email && "border-red-500 focus-visible:ring-red-500",
                  )}
                  {...register("email", {
                    required: "Email обязателен",
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: "Некорректный email",
                    },
                  })}
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>
                )}
              </div>

              {/* Password */}
              <div className="mb-4">
                <Label htmlFor="password" className="text-sm font-medium text-foreground">
                  Новый пароль (оставьте пусто, чтобы не менять)
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="mt-2"
                  {...register("password")}
                />
                {errors.password && (
                  <p className="mt-1 text-sm text-red-500">{errors.password.message}</p>
                )}
              </div>

              {/* Photo */}
              <div className="mb-4">
                <Label className="text-sm font-medium text-foreground">
                  Фото врача
                </Label>
                <div className="mt-2 flex gap-4">
                  <div className="w-20 h-20 rounded-lg bg-muted border border-border overflow-hidden flex items-center justify-center shrink-0">
                    {photoPreview ? (
                      <img
                        src={photoPreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Upload className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={onPhotoChange}
                      className="hidden"
                      id="photo-input"
                    />
                    <label
                      htmlFor="photo-input"
                      className="inline-flex items-center justify-center px-4 py-2 border border-border rounded-lg cursor-pointer hover:bg-muted transition-colors text-sm font-medium"
                    >
                      Загрузить фото
                    </label>
                    {photoPreview && (
                      <button
                        type="button"
                        onClick={() => {
                          setPhoto(null)
                          setPhotoPreview(null)
                        }}
                        className="ml-2 text-sm text-red-600 hover:text-red-700"
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Professional Info Section */}
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">
                Профессиональная информация
              </h2>

              {/* Categories */}
              <div className="mb-6">
                <Label className="text-sm font-medium text-foreground block mb-3">
                  Специальности
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => toggleCategory(category.id)}
                      className={cn(
                        "p-3 rounded-lg border-2 text-left transition-all",
                        selectedCategories.includes(category.id)
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/30",
                      )}
                    >
                      <p className="font-medium text-foreground text-sm">
                        {category.name}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Experience */}
              <div className="mb-4">
                <Label htmlFor="experience" className="text-sm font-medium text-foreground">
                  Стаж (лет)
                </Label>
                <Input
                  id="experience"
                  type="number"
                  placeholder="10"
                  className="mt-2"
                  {...register("experience")}
                />
              </div>

              {/* Degree */}
              <div className="mb-4">
                <Label htmlFor="degree" className="text-sm font-medium text-foreground">
                  Квалификация
                </Label>
                <Input
                  id="degree"
                  placeholder="Кандидат медицинских наук"
                  className="mt-2"
                  {...register("degree")}
                />
              </div>

              {/* Price */}
              <div className="mb-4">
                <Label htmlFor="price" className="text-sm font-medium text-foreground">
                  Стоимость консультации (₽)
                </Label>
                <Input
                  id="price"
                  type="number"
                  placeholder="500"
                  className="mt-2"
                  {...register("price")}
                />
              </div>

              {/* Bio */}
              <div className="mb-4">
                <Label htmlFor="bio" className="text-sm font-medium text-foreground">
                  О себе
                </Label>
                <textarea
                  id="bio"
                  placeholder="Расскажите о себе..."
                  className="mt-2 w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  rows={4}
                  {...register("bio")}
                />
              </div>
            </div>
          </div>

          {/* Education Section */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">
              Образование
            </h2>
            <div className="space-y-3">
              {educationFields.map((field, index) => (
                <div key={field.id} className="flex gap-2">
                  <Input
                    placeholder="Название учебного заведения"
                    className="flex-1"
                    {...register(`education.${index}.value`)}
                  />
                  {educationFields.length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeEducation(index)}
                      className="px-3"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => appendEducation({ value: "" })}
            >
              <Plus className="w-4 h-4" />
              Добавить образование
            </Button>
          </div>

          {/* Services Section */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">
              Услуги
            </h2>
            <div className="space-y-3">
              {serviceFields.map((field, index) => (
                <div key={field.id} className="flex gap-2">
                  <Input
                    placeholder="Название услуги"
                    className="flex-1"
                    {...register(`services.${index}.value`)}
                  />
                  {serviceFields.length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeService(index)}
                      className="px-3"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => appendService({ value: "" })}
            >
              <Plus className="w-4 h-4" />
              Добавить услугу
            </Button>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-4 border-t border-border">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Сохранение...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Сохранить изменения
                </>
              )}
            </Button>
            <Button asChild variant="outline">
              <Link href="/lk-org">
                Отмена
              </Link>
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
