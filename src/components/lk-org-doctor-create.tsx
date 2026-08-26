"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { UserPlus } from "lucide-react"
import { fetchCategoriesAction, revalidateDoctorsAction } from "@/lib/api/actions"
import { deleteOrphanedUploads } from "@/lib/api/media-uploads"
import type { ApiCategory } from "@/lib/api/types"
import { DoctorFormFields } from "@/components/doctor-form/doctor-form-fields"
import { DoctorFormShell } from "@/components/doctor-form/doctor-form-shell"
import { doctorFormDefaults, toListField } from "@/components/doctor-form/types"
import type { DoctorFormValues } from "@/components/doctor-form/types"
import { uploadDoctorMedia } from "@/components/doctor-form/upload-doctor-media"
import { useDoctorPhoto } from "@/components/doctor-form/use-doctor-photo"

interface LkOrgDoctorCreateProps {
  orgId: number
}

export function LkOrgDoctorCreate({ orgId }: LkOrgDoctorCreateProps) {
  const router = useRouter()
  const [categories, setCategories] = useState<ApiCategory[]>([])
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<DoctorFormValues>({ defaultValues: doctorFormDefaults })
  const photo = useDoctorPhoto(setError)

  useEffect(() => {
    fetchCategoriesAction().then(setCategories).catch(() => {})
  }, [])

  async function onSubmit(data: DoctorFormValues) {
    setError(null)
    setSuccess(null)

    // Файлы уходят в media раньше врача, поэтому упавший POST оставил бы их
    // висеть навсегда: ссылки на них так и не появились.
    const uploadedMediaIds: number[] = []
    let doctorSaved = false

    try {
      // 1. Загружаем обрезанный квадрат и исходник — обе версии сразу.
      const altBase = data.name || "Doctor photo"
      let photoId: number | null = null
      let originalId: number | null = null

      if (photo.photo) {
        photoId = await uploadDoctorMedia(photo.photo, altBase)
        if (photoId) uploadedMediaIds.push(photoId)
      }
      // Исходник имеет смысл только вместе с обрезанным квадратом: без photo
      // ссылка photoOriginal не пишется и файл сразу стал бы мусором.
      if (photoId && photo.originalFile) {
        originalId = await uploadDoctorMedia(
          photo.originalFile,
          `${altBase} (оригинал)`,
        )
        if (originalId) uploadedMediaIds.push(originalId)
      }

      // 2. Create the doctor in the doctors collection
      const payload: Record<string, unknown> = {
        email: data.email,
        password: data.password,
        name: data.name,
        organisation: orgId,
      }

      if (data.categories.length > 0) payload.categories = data.categories
      if (data.experience) payload.experience = Number(data.experience)
      if (data.degree) payload.degree = data.degree
      if (data.price) payload.price = Number(data.price)
      if (data.bio) payload.bio = data.bio
      if (photoId) {
        payload.photo = photoId
        if (originalId) payload.photoOriginal = originalId
        if (photo.cropRect) payload.photoCrop = photo.cropRect
      }

      const educationFiltered = toListField(data.education)
      if (educationFiltered.length > 0) payload.education = educationFiltered

      const servicesFiltered = toListField(data.services)
      if (servicesFiltered.length > 0) payload.services = servicesFiltered

      const createRes = await fetch("/api/doctors", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!createRes.ok) {
        const body = await createRes.json().catch(() => null)
        console.error("[lk-org] Doctor creation failed:", {
          status: createRes.status,
          statusText: createRes.statusText,
          body,
        })
        if (createRes.status === 400) {
          throw new Error("Пользователь с таким именем или email уже существует")
        }
        throw new Error(
          body?.errors?.[0]?.message || body?.message || "Ошибка создания врача",
        )
      }

      doctorSaved = true

      // Revalidate doctors cache so lists reflect the new doctor
      await revalidateDoctorsAction()

      setSuccess(`Врач "${data.name || data.email}" успешно создан!`)
      form.reset(doctorFormDefaults)
      photo.removePhoto()

      // Redirect back to org dashboard after short delay
      setTimeout(() => {
        router.push("/lk-org")
        router.refresh()
      }, 1500)
    } catch (err) {
      console.error("[lk-org] onSubmit error:", err)
      // Врач не создался — свежезагруженные файлы никому не принадлежат.
      // Если создание прошло, а упало что-то после (например ревалидация),
      // файлы уже привязаны к врачу и удалять их нельзя.
      if (!doctorSaved) await deleteOrphanedUploads(uploadedMediaIds)
      setError(err instanceof Error ? err.message : "Произошла ошибка")
    }
  }

  return (
    <div className="flex-1">
      <DoctorFormShell
        icon={UserPlus}
        title="Добавить врача"
        subtitle="Заполните данные для регистрации нового врача"
        success={success}
        error={error}
        onDismissSuccess={() => setSuccess(null)}
        onDismissError={() => setError(null)}
      >
        <DoctorFormFields
          form={form}
          categories={categories}
          photo={photo}
          passwordMode="required"
          submitIcon={UserPlus}
          submitLabel="Добавить врача"
          submitPendingLabel="Создание..."
          onSubmit={onSubmit}
        />
      </DoctorFormShell>
    </div>
  )
}
