"use client"

import React, { useCallback } from "react"
import Link from "next/link"
import { Controller, useFieldArray, type UseFormReturn } from "react-hook-form"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ImageCropperDialog } from "@/components/image-cropper-dialog"
import type { ApiCategory } from "@/lib/api/types"
import type { DoctorFormValues } from "./types"
import type { DoctorPhotoState } from "./use-doctor-photo"
import { CheckCircle, Crop, Loader2, Plus, Trash2, Upload } from "lucide-react"

interface DoctorFormFieldsProps {
  form: UseFormReturn<DoctorFormValues>
  categories: ApiCategory[]
  photo: DoctorPhotoState
  /**
   * При создании пароль обязателен, при редактировании пустое поле означает
   * «не менять». Это единственное расхождение в правилах валидации.
   */
  passwordMode: "required" | "optional"
  submitIcon: LucideIcon
  submitLabel: string
  submitPendingLabel: string
  onSubmit: (data: DoctorFormValues) => Promise<void>
}

/**
 * Поля формы врача, общие для создания и редактирования.
 *
 * До этого разметка была скопирована в оба экрана: 569 из 669 строк совпадали
 * дословно, и любая правка поля требовала одинакового изменения в двух файлах.
 */
export function DoctorFormFields({
  form,
  categories,
  photo,
  passwordMode,
  submitIcon: SubmitIcon,
  submitLabel,
  submitPendingLabel,
  onSubmit,
}: DoctorFormFieldsProps) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { isSubmitting, errors },
  } = form

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

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
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
              <p className="text-sm text-destructive">{errors.name.message}</p>
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
                    value: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
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
                {passwordMode === "required"
                  ? "Пароль *"
                  : "Новый пароль (необязательно)"}
              </Label>
              <Input
                id="doctor-password"
                type="password"
                placeholder={
                  passwordMode === "required"
                    ? "Минимум 6 символов"
                    : "Оставьте пустым, чтобы не менять"
                }
                aria-invalid={!!errors.password}
                {...register("password", {
                  required:
                    passwordMode === "required" ? "Обязательное поле" : false,
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
                {...register("experience", { required: "Обязательное поле" })}
              />
              {errors.experience && (
                <p className="text-sm text-destructive">
                  {errors.experience.message}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="doctor-price">
                Стоимость консультации (руб.) *
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
              Специальности *
            </legend>
            <input
              type="hidden"
              {...register("categories", {
                validate: (v) =>
                  v.length > 0 || "Выберите хотя бы одну специальность",
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
                    {isSelected && <CheckCircle className="w-3.5 h-3.5" />}
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
          {photo.photoPreview ? (
            <div className="flex items-center gap-4">
              <div className="w-20 aspect-square rounded-xl overflow-hidden border border-border bg-muted shrink-0">
                <img
                  src={photo.photoPreview}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm text-foreground font-medium">
                  {photo.photo?.name || "Текущее фото"}
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={photo.editCropArea}
                    disabled={!photo.canEditCropArea}
                    className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors disabled:text-muted-foreground disabled:cursor-not-allowed disabled:hover:text-muted-foreground"
                  >
                    <Crop className="w-3.5 h-3.5" />
                    Изменить область
                  </button>
                  <button
                    type="button"
                    onClick={photo.removePhoto}
                    className="inline-flex items-center gap-1 text-sm text-destructive hover:text-destructive/80 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Удалить
                  </button>
                </div>
                {!photo.canEditCropArea && (
                  <p className="text-xs text-muted-foreground">
                    Исходник этого фото не сохранён — загрузите фото заново, чтобы менять область.
                  </p>
                )}
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
                JPG, PNG до 10 МБ — дальше выберете квадратную область
              </span>
              <input
                id="doctor-photo"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={photo.handlePhotoChange}
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
                <span>{submitPendingLabel}</span>
              </>
            ) : (
              <>
                <SubmitIcon className="w-4 h-4" />
                <span>{submitLabel}</span>
              </>
            )}
          </Button>
          <Button type="button" variant="outline" size="lg" asChild>
            <Link href="/lk-org">Отмена</Link>
          </Button>
        </div>
      </form>

      <ImageCropperDialog
        source={photo.cropSource}
        initialCrop={photo.cropRect}
        onCancel={photo.closeCropper}
        onApply={photo.handleCropApply}
      />
    </>
  )
}
