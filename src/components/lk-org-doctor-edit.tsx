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
  Save,
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
  const [existingPhotoId, setExistingPhotoId] = useState<number | null>(null)
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
    },
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
          .map((cat) => (typeof cat === "number" ? cat : cat.id))
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
          education:
            educationList.length > 0
              ? educationList.map((v) => ({ value: v }))
              : [{ value: "" }],
          services:
            servicesList.length > 0
              ? servicesList.map((v) => ({ value: v }))
              : [{ value: "" }],
        })

        // Set photo preview
        if (
          doctorData.photo &&
          typeof doctorData.photo === "object" &&
          "url" in doctorData.photo
        ) {
          setPhotoPreview(doctorData.photo.url as string)
          setExistingPhotoId(doctorData.photo.id)
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

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setPhoto(file)
      setPhotoPreview(URL.createObjectURL(file))
    }
  }

  function removePhoto() {
    setPhoto(null)
    setExistingPhotoId(null)
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview)
      setPhotoPreview(null)
    }
  }

  async function onSubmit(data: DoctorFormValues) {
    setError(null)
    setSuccess(null)

    try {
      // 1. Upload new photo if selected
      let photoId: number | null = existingPhotoId
      if (photo) {
        const formData = new FormData()
        formData.append("file", photo)
        formData.append("alt", data.name || "Doctor photo")
        formData.append(
          "_payload",
          JSON.stringify({ alt: data.name || "Doctor photo" }),
        )

        const uploadRes = await fetch(`${basePath}/api/media`, {
          method: "POST",
          credentials: "include",
          body: formData,
        })

        if (!uploadRes.ok) {
          const body = await uploadRes.json().catch(() => null)
          console.error("[lk-org] Photo upload failed:", body)
          throw new Error(
            body?.errors?.[0]?.message || "Ошибка загрузки фото",
          )
        }

        const uploadData = await uploadRes.json()
        photoId = uploadData.doc?.id ?? null
      }

      // 2. Update doctor via JSON PATCH (same approach as create uses POST with JSON)
      const payload: Record<string, unknown> = {
        name: data.name,
        email: data.email,
        organisation: orgId,
      }

      if (data.password && data.password.trim().length > 0) {
        payload.password = data.password
      }

      if (data.categories.length > 0) {
        payload.categories = data.categories
      } else {
        payload.categories = []
      }

      if (data.experience) payload.experience = Number(data.experience)
      if (data.degree) payload.degree = data.degree
      if (data.price) payload.price = Number(data.price)
      if (data.bio) payload.bio = data.bio

      if (photoId) {
        payload.photo = photoId
      } else {
        payload.photo = null
      }

      const educationFiltered = data.education
        .map((e) => e.value.trim())
        .filter(Boolean)
      payload.education =
        educationFiltered.length > 0
          ? educationFiltered.map((v) => ({ value: v }))
          : []

      const servicesFiltered = data.services
        .map((s) => s.value.trim())
        .filter(Boolean)
      payload.services =
        servicesFiltered.length > 0
          ? servicesFiltered.map((v) => ({ value: v }))
          : []

      const updateRes = await fetch(`${basePath}/api/doctors/${doctorId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!updateRes.ok) {
        const body = await updateRes.json().catch(() => null)
        console.error("[lk-org] Doctor update failed:", body)
        if (updateRes.status === 400) {
          throw new Error(
            "Пользователь с таким именем или email уже существует",
          )
        }
        throw new Error(
          body?.errors?.[0]?.message ||
            body?.message ||
            "Ошибка обновления врача",
        )
      }

      // Revalidate doctors cache
      await revalidateDoctorsAction()

      setSuccess(`Врач "${data.name || data.email}" успешно обновлен!`)

      // Redirect back to org dashboard after short delay
      setTimeout(() => {
        router.push("/lk-org")
        router.refresh()
      }, 1500)
    } catch (err) {
      console.error("[lk-org] onSubmit error:", err)
      setError(err instanceof Error ? err.message : "Произошла ошибка")
    }
  }

  if (isLoading) {
    return (
      <div className="flex-1">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-20">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Врач не найден
            </h2>
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
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back link */}
        <Link
          href="/lk-org"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад к кабинету
        </Link>

        {/* Form card */}
        <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Save className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                Редактирование врача
              </h1>
              <p className="text-sm text-muted-foreground">
                Обновите данные врача
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

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-6"
          >
            {/* Basic info section */}
            <fieldset className="flex flex-col gap-4">
              <legend className="text-sm font-semibold text-foreground mb-2">
                Основная информация
              </legend>

              <div className="flex flex-col gap-2">
                <Label htmlFor="doctor-name">ФИО врача *</Label>
                <Input
                  id="doctor-name"
                  placeholder="Иванов Иван Иванович"
                  aria-invalid={!!errors.name}
                  {...register("name", { required: "Обязательное поле" })}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="doctor-email">Электронная почта *</Label>
                  <Input
                    id="doctor-email"
                    type="email"
                    placeholder="doctor@clinic.ru"
                    aria-invalid={!!errors.email}
                    {...register("email", {
                      required: "Обязательное поле",
                      pattern: {
                        value:
                          /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                        message: "Введите корректный email",
                      },
                    })}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">
                      {errors.email.message}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="doctor-password">
                    Новый пароль (необязательно)
                  </Label>
                  <Input
                    id="doctor-password"
                    type="password"
                    placeholder="Оставьте пустым, чтобы не менять"
                    aria-invalid={!!errors.password}
                    {...register("password", {
                      minLength: {
                        value: 6,
                        message: "Минимум 6 символов",
                      },
                    })}
                  />
                  {errors.password && (
                    <p className="text-sm text-destructive">
                      {errors.password.message}
                    </p>
                  )}
                </div>
              </div>
            </fieldset>

            {/* Professional info */}
            <fieldset className="flex flex-col gap-4">
              <legend className="text-sm font-semibold text-foreground mb-2">
                Профессиональная информация
              </legend>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="doctor-experience">Стаж (лет) *</Label>
                  <Input
                    id="doctor-experience"
                    type="number"
                    min="0"
                    placeholder="10"
                    aria-invalid={!!errors.experience}
                    {...register("experience", {
                      required: "Обязательное поле",
                    })}
                  />
                  {errors.experience && (
                    <p className="text-sm text-destructive">
                      {errors.experience.message}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="doctor-price">
                    Цена консультации (руб.) *
                  </Label>
                  <Input
                    id="doctor-price"
                    type="number"
                    min="0"
                    placeholder="3000"
                    aria-invalid={!!errors.price}
                    {...register("price", { required: "Обязательное поле" })}
                  />
                  {errors.price && (
                    <p className="text-sm text-destructive">
                      {errors.price.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="doctor-degree">Степень / Категория *</Label>
                <Input
                  id="doctor-degree"
                  placeholder="Врач высшей категории, Кандидат медицинских наук"
                  aria-invalid={!!errors.degree}
                  {...register("degree", { required: "Обязательное поле" })}
                />
                {errors.degree && (
                  <p className="text-sm text-destructive">
                    {errors.degree.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="doctor-bio">О враче *</Label>
                <Controller
                  control={control}
                  name="bio"
                  rules={{ required: "Обязательное поле" }}
                  render={({ field, fieldState }) => (
                    <>
                      <textarea
                        id="doctor-bio"
                        rows={4}
                        placeholder="Расскажите о враче, его опыте и квалификации..."
                        aria-invalid={!!fieldState.error}
                        className={cn(
                          "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-medium text-foreground",
                          "placeholder:text-muted-foreground placeholder:font-normal focus-visible:outline-none",
                          "focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                          "resize-y min-h-[100px]",
                        )}
                        {...field}
                      />
                      {fieldState.error && (
                        <p className="text-sm text-destructive">
                          {fieldState.error.message}
                        </p>
                      )}
                    </>
                  )}
                />
              </div>
            </fieldset>

            {/* Categories */}
            {categories.length > 0 && (
              <fieldset className="flex flex-col gap-3">
                <legend className="text-sm font-semibold text-foreground mb-2">
                  Специализации *
                </legend>
                <input
                  type="hidden"
                  {...register("categories", {
                    validate: (v) =>
                      v.length > 0 || "Выберите хотя бы одну специализацию",
                  })}
                />
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => {
                    const isSelected = selectedCategories.includes(cat.id)
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => toggleCategory(cat.id)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all border",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-transparent text-muted-foreground border-border hover:border-primary/40 hover:text-foreground",
                        )}
                      >
                        {isSelected && (
                          <CheckCircle className="w-3.5 h-3.5" />
                        )}
                        {cat.name}
                      </button>
                    )
                  })}
                </div>
                {errors.categories && (
                  <p className="text-sm text-destructive">
                    {errors.categories.message}
                  </p>
                )}
              </fieldset>
            )}

            {/* Photo upload */}
            <fieldset className="flex flex-col gap-3">
              <legend className="text-sm font-semibold text-foreground mb-2">
                Фото врача
              </legend>
              {photoPreview ? (
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-xl overflow-hidden border border-border bg-muted">
                    <img
                      src={photoPreview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-sm text-foreground font-medium">
                      {photo?.name || "Текущее фото"}
                    </p>
                    <button
                      type="button"
                      onClick={removePhoto}
                      className="inline-flex items-center gap-1 text-sm text-destructive hover:text-destructive/80 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Удалить
                    </button>
                  </div>
                </div>
              ) : (
                <label
                  htmlFor="doctor-photo"
                  className={cn(
                    "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border",
                    "py-8 px-4 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all",
                  )}
                >
                  <Upload className="w-6 h-6 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Нажмите для загрузки фото
                  </span>
                  <span className="text-xs text-muted-foreground/60">
                    JPG, PNG до 5 МБ
                  </span>
                  <input
                    id="doctor-photo"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handlePhotoChange}
                  />
                </label>
              )}
            </fieldset>

            {/* Education - dynamic array */}
            <fieldset className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <legend className="text-sm font-semibold text-foreground">
                  Образование *
                </legend>
                <button
                  type="button"
                  onClick={() => appendEducation({ value: "" })}
                  className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Добавить
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {educationFields.map((field, index) => (
                  <div key={field.id} className="flex items-center gap-2">
                    <Input
                      placeholder="Учебное заведение / Курс"
                      {...register(`education.${index}.value`, {
                        required: "Обязательное поле",
                      })}
                    />
                    {educationFields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeEducation(index)}
                        className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all shrink-0"
                        aria-label="Удалить"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </fieldset>

            {/* Services - dynamic array */}
            <fieldset className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <legend className="text-sm font-semibold text-foreground">
                  Услуги *
                </legend>
                <button
                  type="button"
                  onClick={() => appendService({ value: "" })}
                  className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Добавить
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {serviceFields.map((field, index) => (
                  <div key={field.id} className="flex items-center gap-2">
                    <Input
                      placeholder="Название услуги"
                      {...register(`services.${index}.value`, {
                        required: "Обязательное поле",
                      })}
                    />
                    {serviceFields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeService(index)}
                        className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all shrink-0"
                        aria-label="Удалить"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </fieldset>

            {/* Submit */}
            <div className="flex items-center gap-3 pt-2">
              <Button
                type="submit"
                className="sm:w-auto"
                disabled={isSubmitting}
                size="lg"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin" />
                    <span>Сохранение...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Сохранить изменения</span>
                  </>
                )}
              </Button>
              <Button type="button" variant="outline" size="lg" asChild>
                <Link href="/lk-org">Отмена</Link>
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
