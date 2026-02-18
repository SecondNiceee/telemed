"use client"

import React, { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getBasePath } from "@/lib/basePath"
import {
  Plus,
  Trash2,
  Upload,
  CheckCircle,
  AlertCircle,
  Loader2,
  UserPlus,
  X,
} from "lucide-react"

interface Category {
  id: number
  name: string
  slug: string
}

interface FormData {
  name: string
  email: string
  password: string
  categories: number[]
  experience: string
  degree: string
  price: string
  bio: string
  education: string[]
  services: string[]
}

const initialFormData: FormData = {
  name: "",
  email: "",
  password: "",
  categories: [],
  experience: "",
  degree: "",
  price: "",
  bio: "",
  education: [""],
  services: [""],
}

export function LkMedContent({ userName }: { userName: string }) {
  const [form, setForm] = useState<FormData>(initialFormData)
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const basePath = getBasePath()

  useEffect(() => {
    async function loadCategories() {
      try {
        const res = await fetch(`${basePath}/api/doctor-categories?limit=100&sort=name`, {
          credentials: "include",
        })
        if (res.ok) {
          const data = await res.json()
          setCategories(data.docs || [])
        }
      } catch {
        // silently fail
      }
    }
    loadCategories()
  }, [basePath])

  function updateField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setPhoto(file)
      const url = URL.createObjectURL(file)
      setPhotoPreview(url)
    }
  }

  function removePhoto() {
    setPhoto(null)
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview)
      setPhotoPreview(null)
    }
  }

  function toggleCategory(id: number) {
    setForm((prev) => ({
      ...prev,
      categories: prev.categories.includes(id)
        ? prev.categories.filter((c) => c !== id)
        : [...prev.categories, id],
    }))
  }

  function addArrayItem(key: "education" | "services") {
    setForm((prev) => ({ ...prev, [key]: [...prev[key], ""] }))
  }

  function removeArrayItem(key: "education" | "services", index: number) {
    setForm((prev) => ({
      ...prev,
      [key]: prev[key].filter((_, i) => i !== index),
    }))
  }

  function updateArrayItem(key: "education" | "services", index: number, value: string) {
    setForm((prev) => ({
      ...prev,
      [key]: prev[key].map((item, i) => (i === index ? value : item)),
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      // 1. Upload photo if selected
      let photoId: number | null = null
      if (photo) {
        const formData = new window.FormData()
        formData.append("file", photo)
        formData.append("alt", form.name || "Doctor photo")

        const uploadRes = await fetch(`${basePath}/api/media`, {
          method: "POST",
          credentials: "include",
          body: formData,
        })

        if (!uploadRes.ok) {
          const body = await uploadRes.json().catch(() => null)
          throw new Error(body?.errors?.[0]?.message || "Ошибка загрузки фото")
        }

        const uploadData = await uploadRes.json()
        photoId = uploadData.doc?.id ?? null
      }

      // 2. Create the doctor user
      const payload: Record<string, unknown> = {
        email: form.email,
        password: form.password,
        name: form.name,
        role: "doctor",
      }

      if (form.categories.length > 0) payload.categories = form.categories
      if (form.experience) payload.experience = Number(form.experience)
      if (form.degree) payload.degree = form.degree
      if (form.price) payload.price = Number(form.price)
      if (form.bio) payload.bio = form.bio
      if (photoId) payload.photo = photoId

      const educationFiltered = form.education.filter((v) => v.trim())
      if (educationFiltered.length > 0) {
        payload.education = educationFiltered.map((value) => ({ value }))
      }

      const servicesFiltered = form.services.filter((v) => v.trim())
      if (servicesFiltered.length > 0) {
        payload.services = servicesFiltered.map((value) => ({ value }))
      }

      const createRes = await fetch(`${basePath}/api/users`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!createRes.ok) {
        const body = await createRes.json().catch(() => null)
        throw new Error(
          body?.errors?.[0]?.message || body?.message || "Ошибка создания врача"
        )
      }

      setSuccess(`Врач "${form.name || form.email}" успешно создан!`)
      setForm(initialFormData)
      removePhoto()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Произошла ошибка")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground text-balance">
            Кабинет организации
          </h1>
          <p className="text-muted-foreground mt-1">
            Добро пожаловать, {userName}
          </p>
        </div>

        {/* Create doctor form */}
        <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Создать врача
              </h2>
              <p className="text-sm text-muted-foreground">
                Заполните данные для регистрации нового врача
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

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
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
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="doctor-email">Электронная почта *</Label>
                  <Input
                    id="doctor-email"
                    type="email"
                    placeholder="doctor@clinic.ru"
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="doctor-password">Пароль *</Label>
                  <Input
                    id="doctor-password"
                    type="password"
                    placeholder="Минимум 6 символов"
                    value={form.password}
                    onChange={(e) => updateField("password", e.target.value)}
                    required
                    minLength={6}
                  />
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
                  <Label htmlFor="doctor-experience">Стаж (лет)</Label>
                  <Input
                    id="doctor-experience"
                    type="number"
                    min="0"
                    placeholder="10"
                    value={form.experience}
                    onChange={(e) => updateField("experience", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="doctor-price">Цена консультации (руб.)</Label>
                  <Input
                    id="doctor-price"
                    type="number"
                    min="0"
                    placeholder="3000"
                    value={form.price}
                    onChange={(e) => updateField("price", e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="doctor-degree">Степень / Категория</Label>
                <Input
                  id="doctor-degree"
                  placeholder="Врач высшей категории, Кандидат медицинских наук"
                  value={form.degree}
                  onChange={(e) => updateField("degree", e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="doctor-bio">О враче</Label>
                <textarea
                  id="doctor-bio"
                  rows={4}
                  placeholder="Расскажите о враче, его опыте и квалификации..."
                  value={form.bio}
                  onChange={(e) => updateField("bio", e.target.value)}
                  className={cn(
                    "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm",
                    "placeholder:text-muted-foreground focus-visible:outline-none",
                    "focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                    "resize-y min-h-[100px]"
                  )}
                />
              </div>
            </fieldset>

            {/* Categories */}
            {categories.length > 0 && (
              <fieldset className="flex flex-col gap-3">
                <legend className="text-sm font-semibold text-foreground mb-2">
                  Специализации
                </legend>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => {
                    const isSelected = form.categories.includes(cat.id)
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => toggleCategory(cat.id)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all border",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-transparent text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                        )}
                      >
                        {isSelected && <CheckCircle className="w-3.5 h-3.5" />}
                        {cat.name}
                      </button>
                    )
                  })}
                </div>
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
                      {photo?.name}
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
                    "py-8 px-4 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all"
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
                  Образование
                </legend>
                <button
                  type="button"
                  onClick={() => addArrayItem("education")}
                  className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Добавить
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {form.education.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      placeholder="Учебное заведение / Курс"
                      value={item}
                      onChange={(e) =>
                        updateArrayItem("education", index, e.target.value)
                      }
                    />
                    {form.education.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeArrayItem("education", index)}
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
                  Услуги
                </legend>
                <button
                  type="button"
                  onClick={() => addArrayItem("services")}
                  className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Добавить
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {form.services.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      placeholder="Название услуги"
                      value={item}
                      onChange={(e) =>
                        updateArrayItem("services", index, e.target.value)
                      }
                    />
                    {form.services.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeArrayItem("services", index)}
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
            <div className="pt-2">
              <Button
                type="submit"
                className="w-full sm:w-auto"
                disabled={loading}
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" />
                    <span>Создание...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Создать врача</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
