"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { AlertCircle, Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { fetchCategoriesAction, revalidateDoctorsAction } from "@/lib/api/actions"
import { DoctorsApi } from "@/lib/api/doctors"
import { deleteOrphanedUploads } from "@/lib/api/media-uploads"
import type { ApiCategory, ApiDoctor } from "@/lib/api/types"
import { DoctorFormFields } from "@/components/doctor-form/doctor-form-fields"
import { DoctorFormShell } from "@/components/doctor-form/doctor-form-shell"
import { doctorFormDefaults, toListField } from "@/components/doctor-form/types"
import type { DoctorFormValues } from "@/components/doctor-form/types"
import { uploadDoctorMedia } from "@/components/doctor-form/upload-doctor-media"
import { useDoctorPhoto } from "@/components/doctor-form/use-doctor-photo"

interface LkOrgDoctorEditProps {
  doctorId: number
  orgId: number
}

export function LkOrgDoctorEdit({ doctorId, orgId }: LkOrgDoctorEditProps) {
  const router = useRouter()
  const [doctor, setDoctor] = useState<ApiDoctor | null>(null)
  const [categories, setCategories] = useState<ApiCategory[]>([])
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const form = useForm<DoctorFormValues>({ defaultValues: doctorFormDefaults })
  const photo = useDoctorPhoto(setError)

  const { reset } = form
  const { hydrate } = photo

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

        const savedPhoto =
          doctorData.photo &&
          typeof doctorData.photo === "object" &&
          "url" in doctorData.photo
            ? doctorData.photo
            : null

        const savedOriginal =
          doctorData.photoOriginal &&
          typeof doctorData.photoOriginal === "object" &&
          "url" in doctorData.photoOriginal
            ? doctorData.photoOriginal
            : null

        const savedCrop = doctorData.photoCrop

        hydrate({
          photoUrl: (savedPhoto?.url as string | undefined) ?? null,
          photoId: savedPhoto?.id ?? null,
          originalUrl: (savedOriginal?.url as string | undefined) ?? null,
          originalId: savedOriginal?.id ?? null,
          crop:
            savedCrop?.side != null && savedCrop.side > 0
              ? {
                  x: savedCrop.x ?? 0,
                  y: savedCrop.y ?? 0,
                  side: savedCrop.side,
                }
              : null,
        })
      } catch (err) {
        console.error("[lk-org] Failed to load doctor:", err)
        setError("Не удалось загрузить данные врача")
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [doctorId, reset, hydrate])

  async function onSubmit(data: DoctorFormValues) {
    setError(null)
    setSuccess(null)

    // Файлы уходят в media раньше врача, поэтому упавший PATCH оставил бы их
    // висеть навсегда: хук коллекции чистит только то, на что врач ссылался.
    const uploadedMediaIds: number[] = []
    let doctorSaved = false

    try {
      // 1. Загружаем новые файлы. Старые удалит хук коллекции doctors,
      // когда увидит, что ссылка на них сменилась.
      const altBase = data.name || "Doctor photo"
      let photoId: number | null = photo.existingPhotoId
      let originalId: number | null = photo.existingOriginalId

      if (photo.photo) {
        photoId = await uploadDoctorMedia(photo.photo, altBase)
        if (photoId) uploadedMediaIds.push(photoId)
      }
      if (photo.originalFile) {
        originalId = await uploadDoctorMedia(
          photo.originalFile,
          `${altBase} (оригинал)`,
        )
        if (originalId) uploadedMediaIds.push(originalId)
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

      // Всегда пишем все три поля: null здесь — это сигнал хуку удалить файлы.
      payload.photo = photoId ?? null
      payload.photoOriginal = originalId ?? null
      // photoCrop — это group. Payload обходит его подполя и берёт их из
      // объекта группы, а null объектом не считается только по typeof — он его
      // пропускает и падает на siblingData.x («Cannot read properties of null
      // (reading 'x')»). Поэтому «нет области» — это объект с пустыми полями.
      payload.photoCrop =
        photoId && photo.cropRect
          ? photo.cropRect
          : { x: null, y: null, side: null }

      // Пустой массив здесь осмыслен: он стирает прежний список на сервере.
      payload.education = toListField(data.education)
      payload.services = toListField(data.services)

      const updateRes = await fetch(`/api/doctors/${doctorId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!updateRes.ok) {
        const body = await updateRes.json().catch(() => null)
        console.error("[lk-org] Doctor update failed:", body)
        if (updateRes.status === 400) {
          throw new Error("Пользователь с таким именем или email уже существует")
        }
        throw new Error(
          body?.errors?.[0]?.message ||
            body?.message ||
            "Ошибка обновления врача",
        )
      }

      doctorSaved = true

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
      // Врач не сохранился — свежезагруженные файлы никому не принадлежат.
      // Если сохранение прошло, а упало что-то после (например ревалидация),
      // файлы уже привязаны к врачу и удалять их нельзя.
      if (!doctorSaved) await deleteOrphanedUploads(uploadedMediaIds)
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
      <DoctorFormShell
        icon={Save}
        title="Редактирование врача"
        subtitle="Обновите данные врача"
        success={success}
        error={error}
        onDismissSuccess={() => setSuccess(null)}
        onDismissError={() => setError(null)}
      >
        <DoctorFormFields
          form={form}
          categories={categories}
          photo={photo}
          passwordMode="optional"
          submitIcon={Save}
          submitLabel="Сохранить изменения"
          submitPendingLabel="Сохранение..."
          onSubmit={onSubmit}
        />
      </DoctorFormShell>
    </div>
  )
}
